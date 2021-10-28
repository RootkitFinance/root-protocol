const { expect } = require("chai");
const { utils, constants, BigNumber } = require("ethers");
const { ethers } = require("hardhat");
const { createWETH, createUniswap } = require("./helpers");

describe("RootWethZapper", function() {
    let owner, user1, user2, vault;
    let rootKit, weth, keth, rootKitLiquidityGeneration, rootKitDistribution, uniswap, rootWethZapper;

    beforeEach(async function() {
        [owner, user1, user2, vault] = await ethers.getSigners();
        weth = await createWETH();
        uniswap = await createUniswap(owner, weth);
        const rootKitFactory = await ethers.getContractFactory("RootKit");
        const rootKitLiquidityGenerationFactory = await ethers.getContractFactory("RootKitLiquidityGeneration");
        const rootKitDistributionFactory = await ethers.getContractFactory("RootKitDistribution");
        rootKit = await rootKitFactory.connect(owner).deploy();
        const kethFactory = await ethers.getContractFactory("KETH");
        keth = await kethFactory.connect(owner).deploy(weth.address);
        rootKitLiquidityGeneration = await rootKitLiquidityGenerationFactory.connect(owner).deploy(rootKit.address);
        rootKitDistribution = await rootKitDistributionFactory.connect(owner).deploy(rootKit.address, uniswap.router.address, keth.address, uniswap.wbtc.address, vault.address);
        await rootKitDistribution.connect(owner).setupKethRootKit();
        await rootKitDistribution.connect(owner).setupWbtcRootKit();
        const rootKitLiquidityFactory = await ethers.getContractFactory("RootKitLiquidity");
        const kethRootKit = uniswap.pairFor(await uniswap.factory.getPair(keth.address, rootKit.address));
        const wbtcRootKit = uniswap.pairFor(await uniswap.factory.getPair(uniswap.wbtc.address, rootKit.address));
        const wrappedKethRootKit = await rootKitLiquidityFactory.connect(owner).deploy(kethRootKit.address, "a", "b");
        const wrappedWbtcRootKit = await rootKitLiquidityFactory.connect(owner).deploy(wbtcRootKit.address, "a", "b");
        await rootKitDistribution.connect(owner).setupKethRootKit();
        await rootKitDistribution.connect(owner).completeSetup(wrappedKethRootKit.address, wrappedWbtcRootKit.address);
        await rootKit.connect(owner).transfer(rootKitLiquidityGeneration.address, await rootKit.totalSupply());
        await rootKitLiquidityGeneration.connect(owner).activate(rootKitDistribution.address);
        await user1.sendTransaction({ to: rootKitLiquidityGeneration.address, value: utils.parseEther("1") });
        const rootKitTransferGateFactory = await ethers.getContractFactory("RootKitTransferGate");
        const rootKitTransferGate = await rootKitTransferGateFactory.connect(owner).deploy(rootKit.address, uniswap.router.address);
        await rootKit.connect(owner).setTransferGate(rootKitTransferGate.address);
        const rootKitFloorCalculatorFactory = await ethers.getContractFactory("RootKitFloorCalculator");
        const rootKitFloorCalculator = await rootKitFloorCalculatorFactory.connect(owner).deploy(rootKit.address, uniswap.factory.address);
        await keth.setSweeper(rootKitDistribution.address, true);
        await rootKitTransferGate.connect(owner).setUnrestrictedController(rootKitDistribution.address, true);
        await keth.connect(owner).setFloorCalculator(rootKitFloorCalculator.address);
        await rootKitLiquidityGeneration.connect(owner).complete();
        await rootKitLiquidityGeneration.connect(user1).claim();
        const rootWethZapperFactory = await ethers.getContractFactory("RootWethZapper");
        rootWethZapper = await rootWethZapperFactory.connect(owner).deploy();
        await rootKitTransferGate.connect(owner).setUnrestrictedController(rootWethZapper.address, true);
        await rootKit.connect(user1).transfer(owner.address, utils.parseEther("3"));
    })

    it("go", async function() {
        const wethAmount = utils.parseEther("1");
        const rootKitAmount = utils.parseEther("2");
        await owner.sendTransaction({ to: weth.address, value: wethAmount });
        await weth.connect(owner).approve(rootWethZapper.address, wethAmount);
        await rootKit.connect(owner).approve(rootWethZapper.address, rootKitAmount);
        await rootWethZapper.connect(owner).go(weth.address, rootKit.address, wethAmount, rootKitAmount, uniswap.router.address);
        const wethRootKit = uniswap.pairFor(await uniswap.factory.getPair(weth.address, rootKit.address));
    })

})