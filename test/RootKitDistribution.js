const { expect } = require("chai");
const { constants, utils } = require("ethers");
const { ethers } = require("hardhat");
const { createUniswap, createWETH } = require("./helpers");

describe("RootKitDistribution", function() {
    let owner, user1, user2, user3, vault;
    let rootKit, uniswap, keth, rootKitDistribution, weth, wbtc;

    beforeEach(async function() {
        [owner, user1, user2, user3, vault] = await ethers.getSigners();
        weth = await createWETH();
        uniswap = await createUniswap(owner, weth);
        const rootKitFactory = await ethers.getContractFactory("RootKit");
        rootKit = await rootKitFactory.connect(owner).deploy();
        const rootKitTransferGateFactory = await ethers.getContractFactory("RootKitTransferGate");
        const rootKitTransferGate = await rootKitTransferGateFactory.connect(owner).deploy(rootKit.address, uniswap.router.address);
        const kethFactory = await ethers.getContractFactory("KETH");
        keth = await kethFactory.connect(owner).deploy(weth.address);
        const rootKitDistributionFactory = await ethers.getContractFactory("RootKitDistribution");
        rootKitDistribution = await rootKitDistributionFactory.connect(owner).deploy(rootKit.address, uniswap.router.address, keth.address, uniswap.wbtc.address, vault.address);
        await rootKitTransferGate.connect(owner).setUnrestrictedController(rootKitDistribution.address, true);
        await rootKit.transfer(rootKitDistribution.address, utils.parseEther("10000"));
        await rootKit.connect(owner).setTransferGate(rootKitTransferGate.address);
        await keth.connect(owner).setSweeper(rootKitDistribution.address, true);
        const rootKitFloorCalculatorFactory = await ethers.getContractFactory("RootKitFloorCalculator");
        const rootKitFloorCalculator = await rootKitFloorCalculatorFactory.connect(owner).deploy(rootKit.address, uniswap.factory.address);
        await keth.connect(owner).setFloorCalculator(rootKitFloorCalculator.address);
    })

    it("setup works", async function() {
        await rootKitDistribution.setup1();
        await rootKitDistribution.setup2();
    })

    it("initializes as expected", async function() {
        expect(await rootKitDistribution.state()).to.equal(0);
        expect(await rootKitDistribution.rootKit()).to.equal(rootKit.address);
        expect(await rootKitDistribution.contributorsCount()).to.equal(0);
    })

    it("ownerOnly functions fail with non-owner", async function() {
        await expect(rootKitDistribution.connect(user1).activate()).to.be.revertedWith("Owner only");
        await expect(rootKitDistribution.connect(user1).allowRefunds()).to.be.revertedWith("Owner only");
        await expect(rootKitDistribution.connect(user1).complete(1)).to.be.revertedWith("Owner only");
        await expect(rootKitDistribution.connect(user1).distribute()).to.be.revertedWith("Owner only");
        await expect(rootKitDistribution.connect(user1).setup3(owner.address, owner.address)).to.be.revertedWith("Owner only");
    })

    it("eth rejected when inactive", async function() {
        await expect(owner.sendTransaction({ to: rootKitDistribution.address, value: 1 })).to.be.revertedWith("Distribution not active");
    })

    it("claimRefund fails", async function() {
        await expect(rootKitDistribution.claimRefund()).to.be.revertedWith("Everything's fine");
    })

    it("complete fails", async function() {
        await expect(rootKitDistribution.complete(1)).to.be.revertedWith("Not active");
    })

    it("activate fails when inactive", async function() {
        await expect(rootKitDistribution.connect(owner).activate()).to.revertedWith();
    })
    
    describe("setup() and activate()", function() {
        let wrappedKethRootKit, wrappedWbtcRootKit;
        beforeEach(async function() {
            await rootKitDistribution.setup1();
            await rootKitDistribution.setup2();
            const rootKitLiquidityFactory = await ethers.getContractFactory("RootKitLiquidity");
            const kethRootKitAddr = await uniswap.factory.getPair(keth.address, rootKit.address);
            const wbtcRootKitAddr = await uniswap.factory.getPair(uniswap.wbtc.address, rootKit.address);
            wrappedKethRootKit = await rootKitLiquidityFactory.connect(owner).deploy(kethRootKitAddr);
            wrappedWbtcRootKit = await rootKitLiquidityFactory.connect(owner).deploy(wbtcRootKitAddr);
            await rootKitDistribution.setup3(wrappedKethRootKit.address, wrappedWbtcRootKit.address);
            await rootKitDistribution.connect(owner).activate();
        })

        it("sets state", async function() {
            expect(await rootKitDistribution.state()).to.equal(2);
        })

        describe("user1, user2, user3 send 1, 2, and 3 eth", function() {
            beforeEach(async function() {
                await user1.sendTransaction({ to: rootKitDistribution.address, value: utils.parseEther("1") });
                await user2.sendTransaction({ to: rootKitDistribution.address, value: utils.parseEther("1") });
                await user3.sendTransaction({ to: rootKitDistribution.address, value: utils.parseEther("3") });
                await user2.sendTransaction({ to: rootKitDistribution.address, value: utils.parseEther("1") });
            })
                        
            it("claimRefund fails", async function() {
                await expect(rootKitDistribution.claimRefund()).to.be.revertedWith("Everything's fine");
            })
        
            it("claim fails", async function() {
                await expect(rootKitDistribution.claim()).to.be.revertedWith("Distribution not complete");
            })

            it("contributorsCount() == 3", async function() {
                expect(await rootKitDistribution.contributorsCount()).to.equal(3);
                expect(await rootKitDistribution.contribution(owner.address)).to.equal(0);
                expect(await rootKitDistribution.contribution(user1.address)).to.equal(utils.parseEther("1"));
                expect(await rootKitDistribution.contribution(user2.address)).to.equal(utils.parseEther("2"));
                expect(await rootKitDistribution.contribution(user3.address)).to.equal(utils.parseEther("3"));
                expect(await rootKitDistribution.contributors(0)).to.equal(user1.address);
                expect(await rootKitDistribution.contributors(1)).to.equal(user2.address);
                expect(await rootKitDistribution.contributors(2)).to.equal(user3.address);
            })

            describe("allowRefunds()", function() {
                beforeEach(async function() {
                    await rootKitDistribution.connect(owner).allowRefunds();
                })

                it("state == broken", async function() {
                    expect(await rootKitDistribution.state()).to.equal(3);
                })

                it("claimRefund works as expected", async function() {
                    await rootKitDistribution.connect(user1).claimRefund();
                    await rootKitDistribution.connect(user2).claimRefund();
                    await rootKitDistribution.connect(user3).claimRefund();
                    await expect(rootKitDistribution.connect(user2).claimRefund()).to.be.revertedWith("Already claimed");
                })

                it("eth rejected when inactive", async function() {
                    await expect(owner.sendTransaction({ to: rootKitDistribution.address, value: 1 })).to.be.revertedWith("Distribution not active");
                })
            })

            describe("complete(1)", function() {
                let kethRootKit;

                beforeEach(async function() {                    
                    await rootKitDistribution.connect(owner).complete(1);
                    kethRootKit = uniswap.pairFor(await uniswap.factory.getPair(rootKit.address, keth.address));
                })

                it("state == Completing", async function() {
                    expect(await rootKitDistribution.state()).to.equal(4);
                })

                it("balance = 0", async function() {
                    expect(await ethers.provider.getBalance(rootKitDistribution.address)).to.equal(0);
                })

                it("vault balance correct", async function() {
                    expect(await weth.balanceOf(vault.address)).to.equal(utils.parseEther("0.6"));
                })
            })
        })
        describe("user1, user2, user3 send 1000, 2000, and 3000 eth, complete(10)", function() {
            let kethRootKit;
            beforeEach(async function() {
                await user1.sendTransaction({ to: rootKitDistribution.address, value: utils.parseEther("1000") });
                await user2.sendTransaction({ to: rootKitDistribution.address, value: utils.parseEther("2000") });
                await user3.sendTransaction({ to: rootKitDistribution.address, value: utils.parseEther("3000") });
                await rootKitDistribution.connect(owner).complete(10);
                kethRootKit = uniswap.pairFor(await uniswap.factory.getPair(rootKit.address, keth.address));
            })
        })
        describe("user1, user2, user3 send 1000, 2000, and 3000 eth, complete(20)", function() {
            let kethRootKit;
            beforeEach(async function() {
                await user1.sendTransaction({ to: rootKitDistribution.address, value: utils.parseEther("1000") });
                await user2.sendTransaction({ to: rootKitDistribution.address, value: utils.parseEther("2000") });
                await user3.sendTransaction({ to: rootKitDistribution.address, value: utils.parseEther("3000") });
                await rootKitDistribution.connect(owner).complete(20);
                kethRootKit = uniswap.pairFor(await uniswap.factory.getPair(rootKit.address, keth.address));
            })
        })
        describe("user1, user2, user3 send 70000, 70000, and 70000 eth, complete(10)", function() {
            let kethRootKit;
            beforeEach(async function() {
                await user1.sendTransaction({ to: rootKitDistribution.address, value: utils.parseEther("70000") });
                await user2.sendTransaction({ to: rootKitDistribution.address, value: utils.parseEther("70000") });
                await user3.sendTransaction({ to: rootKitDistribution.address, value: utils.parseEther("70000") });
                await rootKitDistribution.connect(owner).complete(10);
                kethRootKit = uniswap.pairFor(await uniswap.factory.getPair(rootKit.address, keth.address));
            })
        })
    })
});