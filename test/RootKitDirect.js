const { expect } = require("chai");
const { utils, constants, BigNumber } = require("ethers");
const { ethers } = require("hardhat");
const { createWETH, createUniswap } = require("./helpers");

describe("RootKitDirect", function() {
    let owner, user1, user2, vault;
    let rootKit, keth, rootKitLiquidityGeneration, rootKitDistribution, uniswap, rootKitDirect;

    beforeEach(async function() {
        [owner, user1, user2, vault] = await ethers.getSigners();
        const weth = await createWETH();
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
        const rootKitDirectFactory = await ethers.getContractFactory("RootKitDirect");
        rootKitDirect = await rootKitDirectFactory.connect(owner).deploy(keth.address, rootKit.address, uniswap.router.address);
        await rootKitTransferGate.allowPool(keth.address);
        await rootKit.connect(user1).approve(rootKitDirect.address, constants.MaxUint256);
        await rootKitTransferGate.setUnrestrictedController(rootKitDirect.address, true);
    })

    it("buy", async function() {
        await rootKitDirect.connect(user2).buy(0, { value: utils.parseEther("1") });
        expect(await rootKit.balanceOf(user2.address)).not.to.equal("0");
    })

    it("easyBuy", async function() {
        await rootKitDirect.connect(user2).easyBuy({ value: utils.parseEther("1") });
        expect(await rootKit.balanceOf(user2.address)).not.to.equal("0");
    })

    it("sell", async function() {
        const oldBalance = BigNumber.from(await ethers.provider.getBalance(user1.address));
        await rootKitDirect.connect(user1).sell(utils.parseEther("1"), 0, { gasPrice: 0 });
        const newBalance = BigNumber.from(await ethers.provider.getBalance(user1.address));
        expect(newBalance.gt(oldBalance)).to.equal(true);
    })

    it("easySell", async function() {
        const oldBalance = BigNumber.from(await ethers.provider.getBalance(user1.address));
        await rootKitDirect.connect(user1).easySell(utils.parseEther("1"), { gasPrice: 0 });
        const newBalance = BigNumber.from(await ethers.provider.getBalance(user1.address));
        expect(newBalance.gt(oldBalance)).to.equal(true);
    })
})