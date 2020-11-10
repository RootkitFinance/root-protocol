const { expect } = require("chai");
const { constants, utils, BigNumber } = require("ethers");
const { ethers } = require("hardhat");

describe("RootKitLiquidityGeneration", function() {
    let owner, user1, user2, user3, rootKit, rootKitLiquidityGeneration, rootKitDistributionFactory;
    let rootKitDistribution;

    beforeEach(async function() {
        [owner, user1, user2, user3] = await ethers.getSigners();
        const rootKitFactory = await ethers.getContractFactory("RootKit");
        rootKit = await rootKitFactory.connect(owner).deploy();
        const rootKitLiquidityGenerationFactory = await ethers.getContractFactory("RootKitLiquidityGeneration");
        rootKitLiquidityGeneration = await rootKitLiquidityGenerationFactory.connect(owner).deploy(rootKit.address);
        rootKitDistributionFactory = await ethers.getContractFactory("RootKitDistributionTest");
        rootKitDistribution = await rootKitDistributionFactory.connect(owner).deploy(rootKit.address);
    })

    it("initializes as expected", async function() {
        expect(await rootKitLiquidityGeneration.isActive()).to.equal(false);
        expect(await rootKitLiquidityGeneration.contributorsCount()).to.equal(0);
        expect(await rootKitLiquidityGeneration.rootKitDistribution()).to.equal(constants.AddressZero);
    })

    it("owner-only functions fail from non-owner", async function() {
        await expect(rootKitLiquidityGeneration.connect(user1).activate(user1.address)).to.be.revertedWith("Owner only");
        await expect(rootKitLiquidityGeneration.connect(user1).setRootKitDistribution(user1.address)).to.be.revertedWith("Owner only");
        await expect(rootKitLiquidityGeneration.connect(user1).complete()).to.be.revertedWith("Owner only");
        await expect(rootKitLiquidityGeneration.connect(user1).allowRefunds()).to.be.revertedWith("Owner only");
    })

    it("active-only functions fail when not active", async function() {
        await expect(rootKitLiquidityGeneration.connect(owner).setRootKitDistribution(user1.address)).to.be.revertedWith("Distribution not active");
        await expect(rootKitLiquidityGeneration.connect(owner).complete()).to.be.revertedWith("Distribution not active");
        await expect(rootKitLiquidityGeneration.connect(owner).allowRefunds()).to.be.revertedWith("Distribution not active");
        await expect(owner.sendTransaction({ to: rootKitLiquidityGeneration.address, value: 1 })).to.be.revertedWith("Distribution not active");
    })

    it("activate() fails with insufficient supply", async function() {
        await expect(rootKitLiquidityGeneration.connect(owner).activate(rootKitDistribution.address)).to.be.revertedWith("Missing supply");
    })

    describe("activate() called", function() {
        beforeEach(async function() {
            await rootKit.connect(owner).transfer(rootKitLiquidityGeneration.address, await rootKit.totalSupply());
            await rootKitLiquidityGeneration.connect(owner).activate(rootKitDistribution.address);
        })

        it("initializes as expected", async function() {
            expect(await rootKitLiquidityGeneration.rootKitDistribution()).to.equal(rootKitDistribution.address);
            expect(await rootKitLiquidityGeneration.isActive()).to.equal(true);
        })

        describe("complete() works as expected", function() {
            it("Can complete", async function() {
                await rootKitLiquidityGeneration.connect(owner).complete();
            })

            it("Can reactivate if nothing ever happened", async function() {
                await rootKitLiquidityGeneration.connect(owner).complete();
                await rootKitLiquidityGeneration.connect(owner).activate(rootKitDistribution.address);
            })
        })

        describe("User 1/2/3 send 1/2/3 ETH", async function() {
            beforeEach(async function() {
                await user1.sendTransaction({ to: rootKitLiquidityGeneration.address, value: utils.parseEther("1") });
                await user2.sendTransaction({ to: rootKitLiquidityGeneration.address, value: utils.parseEther("2") });
                await user3.sendTransaction({ to: rootKitLiquidityGeneration.address, value: utils.parseEther("3") });
            })

            it("records contributions", async function() {
                expect(await rootKitLiquidityGeneration.contributorsCount()).to.equal(3);
                expect(await rootKitLiquidityGeneration.contributors(0)).to.equal(user1.address);
                expect(await rootKitLiquidityGeneration.contributors(1)).to.equal(user2.address);
                expect(await rootKitLiquidityGeneration.contributors(2)).to.equal(user3.address);
                expect(await rootKitLiquidityGeneration.contribution(user1.address)).to.equal(utils.parseEther("1"));
                expect(await rootKitLiquidityGeneration.contribution(user2.address)).to.equal(utils.parseEther("2"));
                expect(await rootKitLiquidityGeneration.contribution(user3.address)).to.equal(utils.parseEther("3"));
            })

            describe("Distribution contract changed", function() {
                let rootKitDistribution2;

                beforeEach(async function() {
                    rootKitDistribution2 = await rootKitDistributionFactory.connect(owner).deploy(rootKit.address);
                    await rootKitLiquidityGeneration.connect(owner).setRootKitDistribution(rootKitDistribution2.address);
                })

                it("initializes as expected", async function() {
                    expect(await rootKitLiquidityGeneration.rootKitDistribution()).to.equal(rootKitDistribution2.address);
                })

                it("complete can't be called immediately", async function() {
                    await expect(rootKitLiquidityGeneration.connect(owner).complete()).to.be.revertedWith("Refund period is still active");
                })

                it("Refunds work", async function() {
                    const balance1 = BigNumber.from(await ethers.provider.getBalance(user1.address));
                    const balance2 = BigNumber.from(await ethers.provider.getBalance(user2.address));
                    const balance3 = BigNumber.from(await ethers.provider.getBalance(user3.address));
                    await rootKitLiquidityGeneration.connect(user1).claim({ gasPrice: 0});
                    await rootKitLiquidityGeneration.connect(user2).claim({ gasPrice: 0});
                    await rootKitLiquidityGeneration.connect(user3).claim({ gasPrice: 0});
                    expect(await ethers.provider.getBalance(rootKitLiquidityGeneration.address)).to.equal("0");
                    expect(await ethers.provider.getBalance(user1.address)).to.equal(balance1.add(utils.parseEther("1")).toString());
                    expect(await ethers.provider.getBalance(user2.address)).to.equal(balance2.add(utils.parseEther("2")).toString());
                    expect(await ethers.provider.getBalance(user3.address)).to.equal(balance3.add(utils.parseEther("3")).toString());
                })
            })

            describe("complete() called", function() {
                beforeEach(async function() {
                    await rootKitLiquidityGeneration.connect(owner).complete();
                })

                it("works as expected", async function() {
                    expect(await rootKitLiquidityGeneration.isActive()).to.equal(false);
                    expect(await ethers.provider.getBalance(rootKitLiquidityGeneration.address)).to.equal("0");
                    expect(await ethers.provider.getBalance(rootKitDistribution.address)).to.equal(utils.parseEther("6"));
                    expect(await rootKit.balanceOf(rootKitDistribution.address)).to.equal(await rootKit.totalSupply());
                })

                it("claim() works", async function() {
                    await rootKitLiquidityGeneration.connect(user1).claim();
                    await rootKitLiquidityGeneration.connect(user2).claim();
                    await rootKitLiquidityGeneration.connect(user3).claim();
                    expect(await rootKitDistribution.claimCallAmount(user1.address)).to.equal(utils.parseEther("1"));
                    expect(await rootKitDistribution.claimCallAmount(user2.address)).to.equal(utils.parseEther("2"));
                    expect(await rootKitDistribution.claimCallAmount(user3.address)).to.equal(utils.parseEther("3"));
                    await expect(rootKitLiquidityGeneration.connect(user1).claim()).to.be.revertedWith("Nothing to claim");
                })
            })
        })
    })
})