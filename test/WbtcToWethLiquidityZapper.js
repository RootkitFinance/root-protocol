const { expect } = require("chai");
const { utils, constants, BigNumber } = require("ethers");
const { ethers } = require("hardhat");
const { createWETH, createUniswap } = require("./helpers.js");

describe("WbtcToWethLiquidityZapper", function() {
    let owner, user1;
    let wbtcToWethLiquidityZapper, uniswap, weth, rootKit, wbtcRootKit, wethRootKit, wrappedWbtcRootKit, wrappedWethRootKit, rootKitRuggableFloorCalculator;

    beforeEach(async function() {
        [owner, user1] = await ethers.getSigners();
        const rootKitFactory = await ethers.getContractFactory("RootKit");
        rootKit = await rootKitFactory.connect(owner).deploy();
        weth = await createWETH();
        uniswap = await createUniswap(owner, weth);
        await uniswap.factory.createPair(uniswap.wbtc.address, rootKit.address);
        await uniswap.factory.createPair(weth.address, rootKit.address);
        wbtcRootKit = uniswap.pairFor(await uniswap.factory.getPair(uniswap.wbtc.address, rootKit.address));
        wethRootKit = uniswap.pairFor(await uniswap.factory.getPair(weth.address, rootKit.address));
        const rootKitLiquidityFactory = await ethers.getContractFactory("RootKitLiquidity");
        wrappedWbtcRootKit = await rootKitLiquidityFactory.connect(owner).deploy(wbtcRootKit.address, "a", "b");
        wrappedWethRootKit = await rootKitLiquidityFactory.connect(owner).deploy(wethRootKit.address, "c", "d");
        const wbtcToWethLiquidityZapperFactory = await ethers.getContractFactory("WbtcToWethLiquidityZapper");
        wbtcToWethLiquidityZapper = await wbtcToWethLiquidityZapperFactory.connect(owner).deploy(uniswap.router.address, wrappedWbtcRootKit.address, rootKit.address);
        const rootKitRuggableFloorCalculatorFactory = await ethers.getContractFactory("RootKitRuggableFloorCalculator");
        rootKitRuggableFloorCalculator = await rootKitRuggableFloorCalculatorFactory.connect(owner).deploy();
        await wrappedWbtcRootKit.connect(owner).setFloorCalculator(rootKitRuggableFloorCalculator.address);
        await wrappedWbtcRootKit.connect(owner).setSweeper(wbtcToWethLiquidityZapper.address, true);
        const rootKitTransferGateFactory = await ethers.getContractFactory("RootKitTransferGate");
        rootKitTransferGate = await rootKitTransferGateFactory.connect(owner).deploy(rootKit.address, uniswap.router.address);
        await rootKit.connect(owner).setTransferGate(rootKitTransferGate.address);
        await rootKitTransferGate.connect(owner).allowPool(weth.address);
        await rootKitTransferGate.connect(owner).allowPool(uniswap.wbtc.address);
        await rootKitTransferGate.connect(owner).setUnrestrictedController(wbtcToWethLiquidityZapper.address, true);

        const amt = utils.parseEther("10");
        await rootKit.connect(owner).approve(uniswap.router.address, constants.MaxUint256);
        await uniswap.wbtc.connect(owner).approve(uniswap.router.address, constants.MaxUint256);
        await wbtcRootKit.connect(owner).approve(wrappedWbtcRootKit.address, constants.MaxUint256);
        await uniswap.router.connect(owner).addLiquidity(rootKit.address, uniswap.wbtc.address, amt, amt, amt, amt, owner.address, 2e9);
        await wrappedWbtcRootKit.connect(owner).depositTokens(await wbtcRootKit.balanceOf(owner.address));
    })

    it("go() fails when nothing below floor", async function() {
        await expect(wbtcToWethLiquidityZapper.connect(owner).go()).to.be.revertedWith("Nothing unwrapped");
    })

    it("go() works", async function() {
        const wrappedWbtcRootKitSupply = BigNumber.from(await wrappedWbtcRootKit.totalSupply());
        const wbtcRootKitRedeemed = wrappedWbtcRootKitSupply.div(2);
        await rootKitRuggableFloorCalculator.connect(owner).setSubFloor(wbtcRootKitRedeemed);
        await wbtcToWethLiquidityZapper.connect(owner).go();
    })
})