const { expect } = require("chai");
const { constants } = require("ethers");
const { ethers } = require("hardhat");

describe("Stoneface", function() {
    let owner, stoneface, user, rootKit;

    beforeEach(async function() {
        [owner, user] = await ethers.getSigners();
        const stonefaceFactory = await ethers.getContractFactory("Stoneface");
        stoneface = await stonefaceFactory.connect(owner).deploy(86400);
        const rootKitFactory = await ethers.getContractFactory("RootKit");
        rootKit = await rootKitFactory.connect(owner).deploy();
    })

    it("initializes as expected", async function() {
        expect(await stoneface.delay()).to.equal(86400);
        expect(await stoneface.pendingTransferOwnershipCount()).to.equal(0);
    })

    it("owner only functions can't be called by non-owner", async function() {
        await expect(stoneface.connect(user).callTransferOwnership(rootKit.address, user.address)).to.be.revertedWith("Owner only");
        await expect(stoneface.connect(user).callTransferOwnershipNow(0)).to.be.revertedWith("Owner only");
        await expect(stoneface.connect(user).callClaimOwnership(rootKit.address)).to.be.revertedWith("Owner only");
        await expect(stoneface.connect(user).watchDistribution(constants.AddressZero)).to.be.revertedWith("Owner only");
    })

    it("owner can call rootKit owner-only functions", async function() {
        await rootKit.connect(owner).setTransferGate(constants.AddressZero);
    })

    describe("rootKit.transferOwnership() called", function() {
        beforeEach(async function() {
            await rootKit.connect(owner).transferOwnership(stoneface.address);
        })

        describe("callClaimOwnership(rootKit) called", function() {
            beforeEach(async function() {
                await stoneface.connect(owner).callClaimOwnership(rootKit.address);
            })

            it("stoneface is owner", async function() {
                expect(await rootKit.owner()).to.equal(stoneface.address);
            })

            it("old owner can't call rootKit owner-only functions", async function() {
                await expect(rootKit.connect(owner).setTransferGate(constants.AddressZero)).to.be.revertedWith("Owner only");
            })

            describe("callTransferOwnership() called", function() {
                beforeEach(async function() {
                    await stoneface.connect(owner).callTransferOwnership(rootKit.address, owner.address);
                })

                it("initializes as expected", async function() {
                    expect(await stoneface.pendingTransferOwnershipCount()).to.equal(1);                    
                    expect((await stoneface.pendingTransferOwnership(0)).target).to.equal(rootKit.address); 
                    expect((await stoneface.pendingTransferOwnership(0)).newOwner).to.equal(owner.address);
                })

                it("callTransferOwnershipNow fails too early", async function() {
                    await expect(stoneface.callTransferOwnershipNow(0)).to.be.revertedWith("Too early");
                    await ethers.provider.send("evm_increaseTime", [86300]);
                    await expect(stoneface.callTransferOwnershipNow(0)).to.be.revertedWith("Too early");
                })

                describe("86400 seconds pass, callTransferOwnershipNow(0) called", function() {
                    beforeEach(async function() {
                        await ethers.provider.send("evm_increaseTime", [86400]);
                        await stoneface.connect(owner).callTransferOwnershipNow(0);
                    })

                    it("initializes as expected", async function() {
                        expect(await stoneface.pendingTransferOwnershipCount()).to.equal(0);
                    })

                    describe("rootKit.claimOwnership() called by owner", function() {
                        beforeEach(async function() {
                            await rootKit.connect(owner).claimOwnership();
                        })

                        it("owner is owner", async function() {
                            expect(await rootKit.owner()).to.equal(owner.address);
                        }) 
                    })
                })

                describe("86400 seconds pass, watching distribution", function() {
                    let rootKitDistribution;

                    beforeEach(async function() {
                        await ethers.provider.send("evm_increaseTime", [86400]);
                        const rootKitDistributionFactory = await ethers.getContractFactory("RootKitDistributionTest");
                        rootKitDistribution = await rootKitDistributionFactory.connect(owner).deploy(rootKit.address);
                        await rootKit.connect(owner).approve(rootKitDistribution.address, constants.MaxUint256);
                        await stoneface.connect(owner).watchDistribution(rootKitDistribution.address);
                    })

                    it("can't call watchDistribution again", async function() {
                        await expect(stoneface.connect(owner).watchDistribution(rootKitDistribution.address)).to.be.revertedWith("Can only be set once");
                    })

                    it("callTransferOwnershipNow fails when distribution incomplete", async function() {
                        await expect(stoneface.connect(owner).callTransferOwnershipNow(0)).to.be.revertedWith("Distribution not yet complete");
                    })

                    describe("distribution complete, callTransferOwnershipNow called, rootKit.claimOwnership() called by owner", function() {
                        beforeEach(async function() {
                            await rootKitDistribution.distribute();
                            await stoneface.connect(owner).callTransferOwnershipNow(0);
                            await rootKit.connect(owner).claimOwnership();
                        })

                        it("owner is owner", async function() {
                            expect(await rootKit.owner()).to.equal(owner.address);
                        }) 
                    })
                })
            })
        })
    })
})