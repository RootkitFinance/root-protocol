const { expect } = require("chai");
const { ethers } = require("hardhat");
const { constants, BigNumber, utils } = require("ethers");

describe("ERC20", function() {
    let erc20, user1, user2;
    
    beforeEach(async function() {
        [user1, user2] = await ethers.getSigners();
        const erc20Factory = await ethers.getContractFactory("ERC20Test");
        erc20 = await erc20Factory.connect(user1).deploy();
    })

    it("init params as expected", async function() {
        expect(await erc20.name()).to.equal("Test");
        expect(await erc20.symbol()).to.equal("TST");
        expect(await erc20.decimals()).to.equal(18);
        expect(await erc20.totalSupply()).to.equal(utils.parseEther("100"));
        expect(await erc20.balanceOf(user1.address)).to.equal(utils.parseEther("100"));
        expect(await erc20.balanceOf(user2.address)).to.equal(0);
        expect(await erc20.allowance(user1.address, user2.address)).to.equal(0);
        expect(await erc20.allowance(user2.address, user1.address)).to.equal(0);
    })

    describe("transfer", function() {
        it("fails with insufficient balance", async function() {
            await expect(erc20.connect(user1).transfer(user2.address, utils.parseEther("101"))).to.be.revertedWith("ERC20: transfer amount exceeds balance");
        })

        it("works as expected", async function() {
            await erc20.connect(user1).transfer(user2.address, utils.parseEther("5"));
            
            expect(await erc20.totalSupply()).to.equal(utils.parseEther("100"));
            expect(await erc20.balanceOf(user1.address)).to.equal(utils.parseEther("95"));
            expect(await erc20.balanceOf(user2.address)).to.equal(utils.parseEther("5"));
            expect(await erc20.allowance(user1.address, user2.address)).to.equal(0);
            expect(await erc20.allowance(user2.address, user1.address)).to.equal(0);
        })
    })

    it("approve works as expected", async function() {
        await erc20.connect(user1).approve(user2.address, utils.parseEther("5000"));
        
        expect(await erc20.balanceOf(user1.address)).to.equal(utils.parseEther("100"));
        expect(await erc20.balanceOf(user2.address)).to.equal(0);
        expect(await erc20.allowance(user1.address, user2.address)).to.equal(utils.parseEther("5000"));
        expect(await erc20.allowance(user2.address, user1.address)).to.equal(0);
    })

    describe("transferFrom", function() {
        it("Fails with insufficient approval", async function() {
            await expect(erc20.transferFrom(user1.address, user2.address, 1)).to.be.revertedWith("ERC20: transfer amount exceeds allowance");
        })

        it("works as expected", async function() {
            await erc20.connect(user1).approve(user2.address, utils.parseEther("5"));
            await erc20.connect(user2).transferFrom(user1.address, user2.address, utils.parseEther("5"));
            
            expect(await erc20.totalSupply()).to.equal(utils.parseEther("100"));
            expect(await erc20.balanceOf(user1.address)).to.equal(utils.parseEther("95"));
            expect(await erc20.balanceOf(user2.address)).to.equal(utils.parseEther("5"));
            expect(await erc20.allowance(user1.address, user2.address)).to.equal(0);
            expect(await erc20.allowance(user2.address, user1.address)).to.equal(0);
        })

        it("doesn't adjust allowance if allowance is max", async function() {
            await erc20.connect(user1).approve(user2.address, constants.MaxUint256);
            await erc20.connect(user2).transferFrom(user1.address, user2.address, utils.parseEther("5"));
            
            expect(await erc20.totalSupply()).to.equal(utils.parseEther("100"));
            expect(await erc20.balanceOf(user1.address)).to.equal(utils.parseEther("95"));
            expect(await erc20.balanceOf(user2.address)).to.equal(utils.parseEther("5"));
            expect(await erc20.allowance(user1.address, user2.address)).to.equal(constants.MaxUint256);
            expect(await erc20.allowance(user2.address, user1.address)).to.equal(0);
        })
    })

    it("increaseAllowance works as expected", async function() {
        await erc20.connect(user1).increaseAllowance(user2.address, 5);
        expect(await erc20.allowance(user1.address, user2.address)).to.equal(5);
        await erc20.connect(user1).increaseAllowance(user2.address, 6);
        expect(await erc20.allowance(user1.address, user2.address)).to.equal(11);
        await expect(erc20.connect(user1).increaseAllowance(user2.address, constants.MaxUint256)).to.be.revertedWith("SafeMath: addition overflow");
    })

    it("decreaseAllowance works as expected", async function() {
        await erc20.connect(user1).approve(user2.address, 11);
        expect(await erc20.allowance(user1.address, user2.address)).to.equal(11);
        await erc20.connect(user1).decreaseAllowance(user2.address, 6);
        expect(await erc20.allowance(user1.address, user2.address)).to.equal(5);
        await expect(erc20.connect(user1).decreaseAllowance(user2.address, 6)).to.be.revertedWith("ERC20: decreased allowance below zero");
    })
})