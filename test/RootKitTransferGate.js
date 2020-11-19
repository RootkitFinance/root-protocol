const { expect } = require("chai");
const { constants, utils } = require("ethers");
const { ethers } = require("hardhat");
const { createUniswap, createWETH } = require("./helpers");

describe("RootKitTransferGate", function() {
    let rootKit, rootKitTransferGate, owner, dev, user1, keth, uniswap, kethRootKit;

    beforeEach(async function() {
        [owner, dev, user1] = await ethers.getSigners();
        const rootKitFactory = await ethers.getContractFactory("RootKit");
        rootKit = await rootKitFactory.connect(owner).deploy();
        const rootKitTransferGateFactory = await ethers.getContractFactory("RootKitTransferGate");
        const weth = await createWETH();
        uniswap = await createUniswap(owner, weth);
        rootKitTransferGate = await rootKitTransferGateFactory.connect(owner).deploy(rootKit.address, uniswap.router.address);
        await rootKit.connect(owner).setTransferGate(rootKitTransferGate.address);
        const kethFactory = await ethers.getContractFactory("KETH");
        keth = await kethFactory.connect(owner).deploy(weth.address);
        await uniswap.factory.createPair(rootKit.address, keth.address);
        const kethRootKitAddress = await uniswap.factory.getPair(rootKit.address, keth.address);
        kethRootKit = uniswap.pairFor(kethRootKitAddress);
    });

    it("initialized as expected", async function() {
        const p = await rootKitTransferGate.parameters();
        expect(p.dev).to.equal(constants.AddressZero);
        expect(p.stake).to.equal(constants.AddressZero);
        expect(p.stakeRate).to.equal(0);
        expect(p.burnRate).to.equal(0);
        expect(p.devRate).to.equal(0);
        expect(await rootKitTransferGate.allowedPoolTokensCount()).to.equal(0);
    })

    it("setParameters fails for non-owner", async function() {
        await expect(rootKitTransferGate.connect(dev).setParameters(dev.address, rootKitTransferGate.address, 100, 200, 400)).to.be.revertedWith("Owner only");
    })

    it("transfer works as expected", async function() {
        await rootKit.connect(owner).transfer(user1.address, utils.parseEther("100"));
        expect(await rootKit.totalSupply()).to.equal(utils.parseEther("10000"));
        expect(await rootKit.balanceOf(owner.address)).to.equal(utils.parseEther("9900"));
        expect(await rootKit.balanceOf(user1.address)).to.equal(utils.parseEther("100"));
        expect(await rootKit.balanceOf(rootKitTransferGate.address)).to.equal(utils.parseEther("0"));
        expect(await rootKit.balanceOf(dev.address)).to.equal(utils.parseEther("0"));
    });

    it("addLiquidity to keth/rootKit fails", async function() {
        await rootKit.connect(owner).approve(uniswap.router.address, utils.parseEther("0.0001"));
        await keth.connect(owner).approve(uniswap.router.address, utils.parseEther("0.0001"));
        await keth.connect(owner).deposit({ value: utils.parseEther("0.0001") });
        await expect(uniswap.router.connect(owner).addLiquidity(keth.address, rootKit.address, utils.parseEther("0.0001"), utils.parseEther("0.0001"), 0, 0, owner.address, 2e9)).to.be.revertedWith("TransferHelper: TRANSFER_FROM_FAILED");
    });

    it("allowPool fails from non-owner", async function() {
        await expect(rootKitTransferGate.connect(user1).allowPool(keth.address)).to.be.revertedWith("Owner only");
    })

    it("setFreeParticipant fails from non-owner", async function() {
        await expect(rootKitTransferGate.connect(user1).setFreeParticipant(user1.address, true)).to.be.revertedWith("Owner only");
    })

    it("unrestricted controlled as expected", async function() {
        await expect(rootKitTransferGate.connect(user1).setUnrestrictedController(user1.address, true)).to.be.revertedWith("Owner only");
        expect(await rootKitTransferGate.unrestrictedControllers(user1.address)).to.equal(false);
        expect(await rootKitTransferGate.unrestricted()).to.equal(false);
        await rootKitTransferGate.connect(owner).setUnrestrictedController(user1.address, true);
        await expect(rootKitTransferGate.connect(owner).setUnrestricted(true)).to.be.revertedWith();
        await rootKitTransferGate.connect(user1).setUnrestricted(true);
        expect(await rootKitTransferGate.unrestrictedControllers(user1.address)).to.equal(true);
        expect(await rootKitTransferGate.unrestricted()).to.equal(true);
        
        await rootKit.connect(owner).approve(uniswap.router.address, utils.parseEther("0.0001"));
        await keth.connect(owner).approve(uniswap.router.address, utils.parseEther("0.0001"));
        await keth.connect(owner).deposit({ value: utils.parseEther("0.0001") });
        await uniswap.router.connect(owner).addLiquidity(keth.address, rootKit.address, utils.parseEther("0.0001"), utils.parseEther("0.0001"), 0, 0, owner.address, 2e9);
        const lp = await kethRootKit.balanceOf(owner.address);
        await kethRootKit.connect(owner).approve(uniswap.router.address, lp);
        await uniswap.router.connect(owner).removeLiquidity(keth.address, rootKit.address, lp, 0, 0, owner.address, 2e9);

        await rootKitTransferGate.connect(user1).setUnrestricted(false);
        expect(await rootKitTransferGate.unrestricted()).to.equal(false);
    });

    describe("setParameters(dev, pool 1%, burn 2%, dev 0.1%)", function() {
        beforeEach(async function() {
            await rootKitTransferGate.connect(owner).setParameters(dev.address, rootKitTransferGate.address, 100, 200, 10);
        })

        it("sets parameters as expected", async function() {
            const p = await rootKitTransferGate.parameters();
            expect(p.dev).to.equal(dev.address);
            expect(p.stakeRate).to.equal(100);
            expect(p.burnRate).to.equal(200);
            expect(p.devRate).to.equal(10);            
        })

        it("transfer works as expected", async function() {
            await rootKit.connect(owner).transfer(user1.address, utils.parseEther("100"));
            expect(await rootKit.totalSupply()).to.equal(utils.parseEther("9998"));
            expect(await rootKit.balanceOf(owner.address)).to.equal(utils.parseEther("9900"));
            expect(await rootKit.balanceOf(user1.address)).to.equal(utils.parseEther("96.9"));
            expect(await rootKit.balanceOf(rootKitTransferGate.address)).to.equal(utils.parseEther("1"));
            expect(await rootKit.balanceOf(dev.address)).to.equal(utils.parseEther("0.1"));
        });

        describe("setFreeParticipant(owner)", function() {
            beforeEach(async function() {
                await rootKitTransferGate.connect(owner).setFreeParticipant(owner.address, true);
            })

            it("sets as expected", async function() {
                expect(await rootKitTransferGate.freeParticipant(owner.address)).to.equal(true);
                await rootKitTransferGate.connect(owner).setFreeParticipant(owner.address, false);
                expect(await rootKitTransferGate.freeParticipant(owner.address)).to.equal(false);
            })

            it("transfer works as expected", async function() {
                await rootKit.connect(owner).transfer(user1.address, utils.parseEther("100"));
                expect(await rootKit.totalSupply()).to.equal(utils.parseEther("10000"));
                expect(await rootKit.balanceOf(owner.address)).to.equal(utils.parseEther("9900"));
                expect(await rootKit.balanceOf(user1.address)).to.equal(utils.parseEther("100"));
                expect(await rootKit.balanceOf(rootKitTransferGate.address)).to.equal(utils.parseEther("0"));
                expect(await rootKit.balanceOf(dev.address)).to.equal(utils.parseEther("0"));
            });
        })

        describe("allowPool(keth)", function() {
            beforeEach(async function() {
                await rootKitTransferGate.connect(owner).allowPool(keth.address);
            })

            it("sets allowedPoolTokens as expected", async function() {
                expect(await rootKitTransferGate.allowedPoolTokensCount()).to.equal(1);
                expect(await rootKitTransferGate.allowedPoolTokens(0)).to.equal(keth.address);
            })
        
            it("add/remove keth/rootKit Liquidity works as expected", async function() {
                await rootKit.connect(owner).approve(uniswap.router.address, utils.parseEther("0.0001"));
                await keth.connect(owner).approve(uniswap.router.address, utils.parseEther("0.0001"));
                await keth.connect(owner).deposit({ value: utils.parseEther("0.0001") });
                await uniswap.router.connect(owner).addLiquidity(keth.address, rootKit.address, utils.parseEther("0.0001"), utils.parseEther("0.0001"), 0, 0, owner.address, 2e9);                
                
                // No easy way to stop a mint/burn combo with nothing in between
                await rootKit.connect(owner).transfer(owner.address, 0);

                await kethRootKit.connect(owner).approve(uniswap.router.address, constants.MaxUint256);
                const lp = await kethRootKit.balanceOf(owner.address);
                await expect(uniswap.router.connect(owner).removeLiquidity(keth.address, rootKit.address, lp, 0, 0, owner.address, 2e9)).to.be.revertedWith("UniswapV2: TRANSFER_FAILED");
            });
        })
    })    
});