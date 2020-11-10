const { expect } = require("chai");
const { utils, BigNumber } = require("ethers");
const { ethers } = require("hardhat");

describe("RootKitVault", function() {
    let owner, user1, rootKitVault, erc20;
    
    beforeEach(async function() {
        [owner, user1] = await ethers.getSigners();
        const rootKitVaultFactory = await ethers.getContractFactory("RootKitVault");
        rootKitVault = await rootKitVaultFactory.connect(owner).deploy();
        const erc20Factory = await ethers.getContractFactory("ERC20Test");
        erc20 = await erc20Factory.connect(owner).deploy();

        await owner.sendTransaction({ to: rootKitVault.address, value: utils.parseEther("2") });
        await erc20.connect(owner).transfer(rootKitVault.address, utils.parseEther("2"));
    })

    it("Can't send ETH or tokens from non-owner", async function() {
        await expect(rootKitVault.connect(user1).sendEther(user1.address, 1)).to.be.revertedWith("Owner only");
        await expect(rootKitVault.connect(user1).sendToken(erc20.address, user1.address, 1)).to.be.revertedWith("Owner only");
    })

    it("Can send ETH", async function() {
        const balance = BigNumber.from(await ethers.provider.getBalance(user1.address));
        await rootKitVault.connect(owner).sendEther(user1.address, 1);
        expect(BigNumber.from(await ethers.provider.getBalance(user1.address)).toString()).to.equal(balance.add(1).toString());
    })

    it("Can send tokens", async function() {
        await rootKitVault.connect(owner).sendToken(erc20.address, user1.address, 1);
        expect(await erc20.balanceOf(user1.address)).to.equal("1");
    })
})