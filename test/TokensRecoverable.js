const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TokensRecoverable", function() {
    let owner, user1, tokensRecoverable, erc20;

    beforeEach(async function() {
        [owner, user1] = await ethers.getSigners();
        const erc20Factory = await ethers.getContractFactory("ERC20Test");
        const tokensRecoverableFactory = await ethers.getContractFactory("TokensRecoverableTest");
        erc20 = await erc20Factory.connect(owner).deploy();
        tokensRecoverable = await tokensRecoverableFactory.connect(owner).deploy();
        await erc20.connect(owner).transfer(tokensRecoverable.address, 10000);
    })

    it("Fails when canRecover is false", async function() {
        await tokensRecoverable.setCanRecover(false);
        await expect(tokensRecoverable.connect(owner).recoverTokens(erc20.address)).to.be.revertedWith();
        await expect(tokensRecoverable.connect(user1).recoverTokens(erc20.address)).to.be.revertedWith("Owner only");
    })

    it("Succeeds when canRecover is true", async function() {
        await tokensRecoverable.setCanRecover(true);
        await expect(tokensRecoverable.connect(user1).recoverTokens(erc20.address)).to.be.revertedWith("Owner only");
        await tokensRecoverable.connect(owner).recoverTokens(erc20.address);
        expect(await erc20.balanceOf(tokensRecoverable.address)).to.equal(0);
        expect(await erc20.balanceOf(owner.address)).to.equal(await erc20.totalSupply());
        await tokensRecoverable.connect(owner).recoverTokens(erc20.address);
    })
    
})