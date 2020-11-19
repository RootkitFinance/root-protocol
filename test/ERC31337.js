const { expect } = require("chai");
const { ethers } = require("hardhat");
const { createWETH, createUniswap } = require("./helpers");
const { utils, constants } = require("ethers");

describe("ERC31337", function() {
    let erc20, owner, erc31337, user1, rootKit, uniswap, user2;

    beforeEach(async function() {
        [owner, user1, user2] = await ethers.getSigners();
        var erc20Factory = await ethers.getContractFactory("ERC20Test");
        erc20 = await erc20Factory.connect(owner).deploy();
        var erc31337Factory = await ethers.getContractFactory("ERC31337");
        const rootKitFactory = await ethers.getContractFactory("RootKit");
        rootKit = await rootKitFactory.deploy();
        erc31337 = await erc31337Factory.deploy(erc20.address, "RootKit [Test]", "RK:TST");
        const weth = await createWETH();
        uniswap = await createUniswap(owner, weth);
    });

    it("initializes as expected", async function() {
        expect(await erc31337.name()).to.equal("RootKit [Test]");
        expect(await erc31337.symbol()).to.equal("RK:TST");
        expect(await erc31337.decimals()).to.equal(18);
        expect(await erc31337.totalSupply()).to.equal(0);
        expect(await erc31337.floorCalculator()).to.equal(constants.AddressZero);
    })

    it("deposit and withdrawal work as expected", async function() {
        await erc20.connect(owner).approve(erc31337.address, utils.parseEther("5"));
        await erc31337.connect(owner).depositTokens(utils.parseEther("5"));
        expect(await erc20.balanceOf(owner.address)).to.equal(utils.parseEther("95"));
        expect(await erc31337.balanceOf(owner.address)).to.equal(utils.parseEther("5"));
        expect(await erc31337.totalSupply()).to.equal(utils.parseEther("5"));

        await erc31337.connect(owner).transfer(user1.address, utils.parseEther("3"));
        await erc31337.connect(user1).withdrawTokens(utils.parseEther("3"));
        expect(await erc20.balanceOf(owner.address)).to.equal(utils.parseEther("95"));
        expect(await erc20.balanceOf(user1.address)).to.equal(utils.parseEther("3"));
        expect(await erc31337.balanceOf(owner.address)).to.equal(utils.parseEther("2"));
        expect(await erc31337.totalSupply()).to.equal(utils.parseEther("2"));
    })

    it("setFloorCalculator doesn't work for non-owner", async function() {
        await expect(erc31337.connect(user1).setFloorCalculator(owner.address)).to.be.revertedWith("Owner only");
    })

    it("sweepFloor doesn't work for non-sweeper", async function() {
        await expect(erc31337.connect(user1).sweepFloor(owner.address)).to.be.revertedWith("Sweepers only");
        await expect(erc31337.connect(owner).sweepFloor(owner.address)).to.be.revertedWith("Sweepers only");
    })

    it("setSweeper doesn't work for non-owner", async function() {
        await expect(erc31337.connect(user1).setSweeper(owner.address, true)).to.be.revertedWith("Owner only");
    })

    describe("setFloorCalculator(RootKitFloorCalculator)", function() {
        let rootKitFloorCalculator;

        beforeEach(async function() {
            const rootKitFloorCalculatorFactory = await ethers.getContractFactory("RootKitFloorCalculator");
            rootKitFloorCalculator = await rootKitFloorCalculatorFactory.connect(owner).deploy(rootKit.address, uniswap.factory.address);
            await erc31337.connect(owner).setFloorCalculator(rootKitFloorCalculator.address);
            await erc31337.connect(owner).approve(uniswap.router.address, constants.MaxUint256);
            await rootKit.connect(owner).approve(uniswap.router.address, constants.MaxUint256);
            await erc20.connect(owner).approve(erc31337.address, constants.MaxUint256);
            await erc31337.connect(owner).depositTokens(utils.parseEther("1"));
            await uniswap.router.connect(owner).addLiquidity(erc31337.address, rootKit.address, utils.parseEther("1"), utils.parseEther("5000"), utils.parseEther("1"), utils.parseEther("5000"), owner.address, 2e9);
        })

        it("initializes correctly", async function() {
            expect(await erc31337.floorCalculator()).to.equal(rootKitFloorCalculator.address);
        })

        it("sweepFloor works", async function() {
            await erc31337.connect(owner).setSweeper(owner.address, true);
            await erc31337.connect(owner).sweepFloor(user2.address);
            const erc20Balance = await erc20.balanceOf(user2.address);
            await erc31337.connect(owner).sweepFloor(user2.address);
            const erc20Balance2 = await erc20.balanceOf(user2.address);
            expect(erc20Balance).to.equal("500751126690035053");
            expect(erc20Balance).to.equal(erc20Balance2);
        })
    })
});