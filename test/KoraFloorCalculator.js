const { expect } = require("chai");
const { utils, constants, BigNumber } = require("ethers");
const { ethers } = require("hardhat");
const { createWETH, createUniswap } = require("./helpers");

describe("KoraFloorCalculator", function() {
    let uniswap, kora, owner, weth, keth, koraFloorCalculator;

    beforeEach(async function() {
        [owner] = await ethers.getSigners();
        weth = await createWETH();
        uniswap = await createUniswap(owner, weth);
        const koraFactory = await ethers.getContractFactory("Kora");
        kora = await koraFactory.connect(owner).deploy();
        const koraFloorCalculatorFactory = await ethers.getContractFactory("KoraFloorCalculator");
        koraFloorCalculator = await koraFloorCalculatorFactory.deploy(kora.address, uniswap.factory.address);
        const kethFactory = await ethers.getContractFactory("KETH");
        keth = await kethFactory.connect(owner).deploy(weth.address, kora.address);
    })

    describe("pair has 5000 KORA & 1 KETH", function() {
        beforeEach(async function() {
            await keth.connect(owner).approve(uniswap.router.address, constants.MaxUint256);
            await kora.connect(owner).approve(uniswap.router.address, constants.MaxUint256);
            await owner.sendTransaction({ to: keth.address, value: utils.parseEther("1") });
            await uniswap.router.connect(owner).addLiquidity(kora.address, keth.address, utils.parseEther("5000"), utils.parseEther("1"), utils.parseEther("100"), utils.parseEther("1"), owner.address, 2e9);
        })

        it("subfloor is approx 0.5", async function() {
            const subFloor = BigNumber.from(await koraFloorCalculator.calculateSubFloor(kora.address, weth.address, keth.address));
            expect(subFloor).to.equal("500751126690035053");
        })
    })
});