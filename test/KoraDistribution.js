const { expect } = require("chai");
const { constants, utils } = require("ethers");
const { ethers } = require("hardhat");
const { createUniswap, createWETH } = require("./helpers");

describe("KoraDistribution", function() {
    let owner, user1, user2, user3;
    let kora, uniswap, keth, koraDistribution;

    beforeEach(async function() {
        [owner, user1, user2, user3] = await ethers.getSigners();
        const weth = await createWETH();
        uniswap = await createUniswap(owner, weth);
        const koraFactory = await ethers.getContractFactory("Kora");
        kora = await koraFactory.connect(owner).deploy();
        const koraTransferGateFactory = await ethers.getContractFactory("KoraTransferGate");
        const koraTransferGate = await koraTransferGateFactory.connect(owner).deploy(kora.address, uniswap.router.address);
        const kethFactory = await ethers.getContractFactory("KETH");
        keth = await kethFactory.connect(owner).deploy(weth.address, kora.address);
        const koraDistributionFactory = await ethers.getContractFactory("KoraDistribution");
        koraDistribution = await koraDistributionFactory.connect(owner).deploy(kora.address, uniswap.router.address, keth.address);
        await koraTransferGate.connect(owner).setUnrestrictedController(koraDistribution.address, true);
        await kora.transfer(koraDistribution.address, utils.parseEther("10000"));
        await kora.connect(owner).setTransferGate(koraTransferGate.address);
        await keth.connect(owner).setSweeper(koraDistribution.address, true);
        const koraFloorCalculatorFactory = await ethers.getContractFactory("KoraFloorCalculator");
        const koraFloorCalculator = await koraFloorCalculatorFactory.connect(owner).deploy(kora.address, uniswap.factory.address);
        await keth.connect(owner).setFloorCalculator(koraFloorCalculator.address);
    })

    it("initializes as expected", async function() {
        expect(await koraDistribution.isActive()).to.equal(false);
        expect(await koraDistribution.kora()).to.equal(kora.address);
        expect(await koraDistribution.contributorsCount()).to.equal(0);
        expect(await koraDistribution.contributorDistributionIndex()).to.equal(0);
        expect(await koraDistribution.isComplete()).to.equal(false);
    })

    it("ownerOnly functions fail with non-owner", async function() {
        await expect(koraDistribution.connect(user1).activate()).to.be.revertedWith("Owner only");
        await expect(koraDistribution.connect(user1).allowRefunds()).to.be.revertedWith("Owner only");
        await expect(koraDistribution.connect(user1).deactivate()).to.be.revertedWith("Owner only");
    })

    it("eth rejected when inactive", async function() {
        await expect(owner.sendTransaction({ to: koraDistribution.address, value: 1 })).to.be.revertedWith("Distribution not active");
    })

    it("claimRefund fails", async function() {
        await expect(koraDistribution.claimRefund()).to.be.revertedWith("Everything's fine");
    })

    it("distribute fails", async function() {
        await expect(koraDistribution.distribute(1)).to.be.revertedWith("Nothing to distribute");
    })

    describe("activate()", function() {
        beforeEach(async function() {
            await koraDistribution.connect(owner).activate();
        })

        it("sets isActive = true", async function() {
            expect(await koraDistribution.isActive()).to.equal(true);
        })

        it("can be de/re-activated if no activity", async function() {
            await koraDistribution.connect(owner).deactivate();
            expect(await koraDistribution.isActive()).to.equal(false);
            await koraDistribution.connect(owner).activate();
            expect(await koraDistribution.isActive()).to.equal(true);
        })

        describe("user1, user2, user3 send 1, 2, and 3 eth", function() {
            beforeEach(async function() {
                await user1.sendTransaction({ to: koraDistribution.address, value: utils.parseEther("1") });
                await user2.sendTransaction({ to: koraDistribution.address, value: utils.parseEther("1") });
                await user3.sendTransaction({ to: koraDistribution.address, value: utils.parseEther("3") });
                await user2.sendTransaction({ to: koraDistribution.address, value: utils.parseEther("1") });
            })
            
            it("isComplete == false", async function() {
                expect(await koraDistribution.isComplete()).to.equal(false);
            })
            
            it("claimRefund fails", async function() {
                await expect(koraDistribution.claimRefund()).to.be.revertedWith("Everything's fine");
            })
        
            it("distribute fails", async function() {
                await expect(koraDistribution.distribute(1)).to.be.revertedWith("Nothing to distribute");
            })

            it("contributorsCount() == 3", async function() {
                expect(await koraDistribution.contributorsCount()).to.equal(3);
                expect(await koraDistribution.contribution(owner.address)).to.equal(0);
                expect(await koraDistribution.contribution(user1.address)).to.equal(utils.parseEther("1"));
                expect(await koraDistribution.contribution(user2.address)).to.equal(utils.parseEther("2"));
                expect(await koraDistribution.contribution(user3.address)).to.equal(utils.parseEther("3"));
                expect(await koraDistribution.contributors(0)).to.equal(user1.address);
                expect(await koraDistribution.contributors(1)).to.equal(user2.address);
                expect(await koraDistribution.contributors(2)).to.equal(user3.address);
            })

            describe("allowRefunds()", function() {
                beforeEach(async function() {
                    await koraDistribution.connect(owner).allowRefunds();
                })

                it("isComplete == false", async function() {
                    expect(await koraDistribution.isComplete()).to.equal(false);
                })

                it("isActive == false", async function() {
                    expect(await koraDistribution.isActive()).to.equal(false);
                })

                it("claimRefund works as expected", async function() {
                    await koraDistribution.connect(user1).claimRefund();
                    await koraDistribution.connect(user2).claimRefund();
                    await koraDistribution.connect(user3).claimRefund();
                    await expect(koraDistribution.connect(user2).claimRefund()).to.be.revertedWith("Already claimed");
                })

                it("eth rejected when inactive", async function() {
                    await expect(owner.sendTransaction({ to: koraDistribution.address, value: 1 })).to.be.revertedWith("Distribution not active");
                })
            })

            describe("deactivate()", function() {
                let kethKora;

                beforeEach(async function() {                    
                    await koraDistribution.connect(owner).deactivate();
                    kethKora = uniswap.pairFor(await uniswap.factory.getPair(kora.address, keth.address));
                })

                it("isComplete == false", async function() {
                    expect(await koraDistribution.isComplete()).to.equal(false);
                })

                it("isActive == false", async function() {
                    expect(await koraDistribution.isActive()).to.equal(false);
                })

                it("balance = 0", async function() {
                    expect(await kora.balanceOf(koraDistribution.address)).to.equal(0);
                    expect(await ethers.provider.getBalance(koraDistribution.address)).to.equal(0);
                })

                it("distribute iterates", async function() {
                    await koraDistribution.distribute(1);
                    expect(await koraDistribution.isComplete()).to.equal(false);
                    await koraDistribution.distribute(1);
                    expect(await koraDistribution.isComplete()).to.equal(false);
                    await koraDistribution.distribute(1);
                    expect(await koraDistribution.isComplete()).to.equal(true);
                })

                describe("distribute(3)", function() {
                    beforeEach(async function() {
                        await koraDistribution.distribute(3);
                    })

                    it("isComplete == true", async function() {
                        expect(await koraDistribution.isComplete()).to.equal(true);
                    })

                    it("distributes lp correctly", async function() {
                        const lp1 = await kethKora.balanceOf(user1.address);
                        const lp2 = await kethKora.balanceOf(user2.address);
                        const lp3 = await kethKora.balanceOf(user3.address);
                        expect(lp1).to.equal(lp2.div(2));
                        expect(lp1).to.equal(lp3.div(3));
                    })
                })
            })
        })
    })
});