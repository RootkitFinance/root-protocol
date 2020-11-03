const { expect } = require("chai");
const { ethers } = require("hardhat");
const { createWETH, createUniswap } = require("./helpers");
const { utils, constants } = require("ethers");

describe("ERC20Backing", function() {
    let erc20, owner, erc20Backing, user1, kora, uniswap, user2;

    beforeEach(async function() {
        [owner, user1, user2] = await ethers.getSigners();
        var erc20Factory = await ethers.getContractFactory("ERC20Test");
        erc20 = await erc20Factory.connect(owner).deploy();
        var erc20BackingFactory = await ethers.getContractFactory("ERC20Backing");
        const koraFactory = await ethers.getContractFactory("Kora");
        kora = await koraFactory.deploy();
        erc20Backing = await erc20BackingFactory.deploy(erc20.address, kora.address);
        const weth = await createWETH();
        uniswap = await createUniswap(owner, weth);
    });

    it("initializes as expected", async function() {
        expect(await erc20Backing.name()).to.equal("KORA [Test]");
        expect(await erc20Backing.symbol()).to.equal("K:TST");
        expect(await erc20Backing.decimals()).to.equal(18);
        expect(await erc20Backing.totalSupply()).to.equal(0);
        expect(await erc20Backing.floorCalculator()).to.equal(constants.AddressZero);
    })

    it("deposit and withdrawal work as expected", async function() {
        await erc20.connect(owner).approve(erc20Backing.address, utils.parseEther("5"));
        await erc20Backing.connect(owner).depositTokens(utils.parseEther("5"));
        expect(await erc20.balanceOf(owner.address)).to.equal(utils.parseEther("95"));
        expect(await erc20Backing.balanceOf(owner.address)).to.equal(utils.parseEther("5"));
        expect(await erc20Backing.totalSupply()).to.equal(utils.parseEther("5"));

        await erc20Backing.connect(owner).transfer(user1.address, utils.parseEther("3"));
        await erc20Backing.connect(user1).withdrawTokens(utils.parseEther("3"));
        expect(await erc20.balanceOf(owner.address)).to.equal(utils.parseEther("95"));
        expect(await erc20.balanceOf(user1.address)).to.equal(utils.parseEther("3"));
        expect(await erc20Backing.balanceOf(owner.address)).to.equal(utils.parseEther("2"));
        expect(await erc20Backing.totalSupply()).to.equal(utils.parseEther("2"));
    })

    it("setFloorCalculator doesn't work for non-owner", async function() {
        await expect(erc20Backing.connect(user1).setFloorCalculator(owner.address)).to.be.revertedWith("Owner only");
    })

    it("sweepFloor doesn't work for non-sweeper", async function() {
        await expect(erc20Backing.connect(user1).sweepFloor(owner.address)).to.be.revertedWith("Sweepers only");
        await expect(erc20Backing.connect(owner).sweepFloor(owner.address)).to.be.revertedWith("Sweepers only");
    })

    it("setSweeper doesn't work for non-owner", async function() {
        await expect(erc20Backing.connect(user1).setSweeper(owner.address, true)).to.be.revertedWith("Owner only");
    })

    describe("setFloorCalculator(KoraFloorCalculator)", function() {
        let koraFloorCalculator;

        beforeEach(async function() {
            const koraFloorCalculatorFactory = await ethers.getContractFactory("KoraFloorCalculator");
            koraFloorCalculator = await koraFloorCalculatorFactory.connect(owner).deploy(kora.address, uniswap.factory.address);
            await erc20Backing.connect(owner).setFloorCalculator(koraFloorCalculator.address);
            await erc20Backing.connect(owner).approve(uniswap.router.address, constants.MaxUint256);
            await kora.connect(owner).approve(uniswap.router.address, constants.MaxUint256);
            await erc20.connect(owner).approve(erc20Backing.address, constants.MaxUint256);
            await erc20Backing.connect(owner).depositTokens(utils.parseEther("1"));
            await uniswap.router.connect(owner).addLiquidity(erc20Backing.address, kora.address, utils.parseEther("1"), utils.parseEther("5000"), utils.parseEther("1"), utils.parseEther("5000"), owner.address, 2e9);
        })

        it("initializes correctly", async function() {
            expect(await erc20Backing.floorCalculator()).to.equal(koraFloorCalculator.address);
        })

        it("sweepFloor works", async function() {
            await erc20Backing.connect(owner).setSweeper(owner.address, true);
            await erc20Backing.connect(owner).sweepFloor(user2.address);
            const erc20Balance = await erc20.balanceOf(user2.address);
            await erc20Backing.connect(owner).sweepFloor(user2.address);
            const erc20Balance2 = await erc20.balanceOf(user2.address);
            expect(erc20Balance).to.equal("500751126690035053");
            expect(erc20Balance).to.equal(erc20Balance2);
        })
    })
});