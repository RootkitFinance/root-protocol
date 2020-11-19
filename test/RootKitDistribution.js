const { expect } = require("chai");
const { ethers } = require("hardhat");
const { createWETH, createUniswap } = require("./helpers");
const { utils, BigNumber } = require("ethers");

describe("RootKitDistribution", function() {
    let owner, user1, user2, user3, rootKit, rootKitLiquidityGeneration;
    let rootKitDistribution, weth, keth, uniswap, rootKitVault;

    beforeEach(async function() {
        [owner, user1, user2, user3] = await ethers.getSigners();
        const rootKitFactory = await ethers.getContractFactory("RootKit");
        rootKit = await rootKitFactory.connect(owner).deploy();
        const rootKitLiquidityGenerationFactory = await ethers.getContractFactory("RootKitLiquidityGeneration");
        rootKitLiquidityGeneration = await rootKitLiquidityGenerationFactory.connect(owner).deploy(rootKit.address);
        const rootKitVaultFactory = await ethers.getContractFactory("RootKitVault");
        rootKitVault = await rootKitVaultFactory.connect(owner).deploy();
        weth = await createWETH();
        uniswap = await createUniswap(owner, weth);
        const kethFactory = await ethers.getContractFactory("KETH");
        keth = await kethFactory.connect(owner).deploy(weth.address);
        const rootKitDistributionFactory = await ethers.getContractFactory("RootKitDistribution");
        rootKitDistribution = await rootKitDistributionFactory.connect(owner).deploy(rootKit.address, uniswap.router.address, keth.address, uniswap.wbtc.address, rootKitVault.address);
        const rootKitTransferGateFactory = await ethers.getContractFactory("RootKitTransferGate");
        const rootKitTransferGate = await rootKitTransferGateFactory.connect(owner).deploy(rootKit.address, uniswap.router.address);
        await rootKit.connect(owner).setTransferGate(rootKitTransferGate.address);
        await rootKitTransferGate.connect(owner).setUnrestrictedController(rootKitDistribution.address, true);
        await keth.connect(owner).setSweeper(rootKitDistribution.address, true);
        const rootKitFloorCalculatorFactory = await ethers.getContractFactory("RootKitFloorCalculator");
        const rootKitFloorCalculator = await rootKitFloorCalculatorFactory.connect(owner).deploy(rootKit.address, uniswap.factory.address);
        await keth.connect(owner).setFloorCalculator(rootKitFloorCalculator.address);

        await rootKit.connect(owner).transfer(rootKitLiquidityGeneration.address, await rootKit.totalSupply());
        await rootKitLiquidityGeneration.connect(owner).activate(rootKitDistribution.address);
        await user1.sendTransaction({ to: rootKitLiquidityGeneration.address, value: utils.parseEther("1") });
        await user2.sendTransaction({ to: rootKitLiquidityGeneration.address, value: utils.parseEther("2") });
        await user3.sendTransaction({ to: rootKitLiquidityGeneration.address, value: utils.parseEther("3") });
    })

    it("initializes as expected", async function() {
        expect(await rootKitDistribution.totalEthCollected()).to.equal(0);
        expect(await rootKitDistribution.totalRootKitBought()).to.equal(0);
        expect(await rootKitDistribution.totalWbtcRootKit()).to.equal(0);
        expect(await rootKitDistribution.totalKethRootKit()).to.equal(0);
        expect(await rootKitDistribution.jengaCount()).to.equal(0);
        expect(await rootKitDistribution.vaultPercent()).to.equal(2500);
        expect(await rootKitDistribution.buyPercent()).to.equal(2500);
        expect(await rootKitDistribution.wbtcPercent()).to.equal(2500);
    })

    it("owner-only functions can't be called by non-owner", async function() {
        await expect(rootKitDistribution.connect(user1).completeSetup(user1.address, user2.address)).to.be.revertedWith("Owner only");
        await expect(rootKitDistribution.connect(user1).setJengaCount(1)).to.be.revertedWith("Owner only");
    })

    describe("setupKethRootKit() and setupWbtcRootKit() called", function() {
        let kethRootKit, wbtcRootKit;
        let wrappedKethRootKit, wrappedWbtcRootKit;

        beforeEach(async function() {
            await rootKitDistribution.connect(owner).setupKethRootKit();
            await rootKitDistribution.connect(owner).setupWbtcRootKit();

            kethRootKit = uniswap.pairFor(await uniswap.factory.getPair(keth.address, rootKit.address));
            wbtcRootKit = uniswap.pairFor(await uniswap.factory.getPair(uniswap.wbtc.address, rootKit.address));
            const rootKitLiquidityFactory = await ethers.getContractFactory("RootKitLiquidity");
            wrappedKethRootKit = await rootKitLiquidityFactory.connect(owner).deploy(kethRootKit.address, "wrappedKethRootKit", "KETHROOT");
            wrappedWbtcRootKit = await rootKitLiquidityFactory.connect(owner).deploy(wbtcRootKit.address, "wrappedWbtcRootKit", "WBTCROOT");
        })

        it("completeSetup() with mismatched pairs don't work", async function() {
            await expect(rootKitDistribution.connect(owner).completeSetup(wrappedWbtcRootKit.address, wrappedKethRootKit.address)).to.be.revertedWith("Wrong LP Wrapper");
        })

        describe("completeSetup() called", function() {
            beforeEach(async function() {
                await rootKitDistribution.connect(owner).completeSetup(wrappedKethRootKit.address, wrappedWbtcRootKit.address);
            })

            describe("complete() called", function() {
                beforeEach(async function() {
                    await rootKitLiquidityGeneration.connect(owner).complete();
                })

                it("initialized as expected", async function() {                    
                    expect(await rootKitDistribution.totalEthCollected()).to.equal(utils.parseEther("6"));
                    expect(await rootKitDistribution.totalRootKitBought()).not.to.equal(0);
                    expect(await rootKitDistribution.totalWbtcRootKit()).not.to.equal(0);
                    expect(await rootKitDistribution.totalKethRootKit()).not.to.equal(0);
                })

                it("distributed as expected", async function() {         
                    const target = BigNumber.from(utils.parseEther("1.5"));
                    expect(BigNumber.from(await weth.balanceOf(owner.address)).gt(target)).to.equal(true);
                    expect(BigNumber.from(await weth.balanceOf(rootKitVault.address)).eq(target)).to.equal(true);
                    expect(await ethers.provider.getBalance(rootKitDistribution.address)).to.equal(0);
                })
            })
        })

        describe("setJengaCount(1) then completeSetup() called", function() {
            beforeEach(async function() {
                await rootKitDistribution.connect(owner).setJengaCount(1);
                await rootKitDistribution.connect(owner).completeSetup(wrappedKethRootKit.address, wrappedWbtcRootKit.address);
            })

            describe("distribute() called", function() {
                beforeEach(async function() {
                    await rootKitLiquidityGeneration.connect(owner).complete();
                })

                it("initialized as expected", async function() {                    
                    expect(await rootKitDistribution.totalEthCollected()).to.equal(utils.parseEther("6"));
                    expect(await rootKitDistribution.totalRootKitBought()).not.to.equal(0);
                    expect(await rootKitDistribution.totalWbtcRootKit()).not.to.equal(0);
                    expect(await rootKitDistribution.totalKethRootKit()).not.to.equal(0);
                })

                it("distributed as expected", async function() {
                    const target = BigNumber.from(utils.parseEther("1.5"));
                    expect(BigNumber.from(await weth.balanceOf(owner.address)).gt(target)).to.equal(true);
                    expect(BigNumber.from(await weth.balanceOf(rootKitVault.address)).eq(target)).to.equal(true);
                    expect(await ethers.provider.getBalance(rootKitDistribution.address)).to.equal(0);
                })
            })
        })
    })
})