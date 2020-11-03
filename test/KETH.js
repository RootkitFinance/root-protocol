const { createWETH, createUniswap } = require("./helpers.js");
const { ethers } = require("hardhat");
const { expect } = require("chai");


describe("KETH", function() {
    let weth, keth, owner, kora;

    beforeEach(async function() {
        [owner] = await ethers.getSigners();
        weth = await createWETH();
        const koraFactory = await ethers.getContractFactory("Kora");
        kora = await koraFactory.deploy();
        const kethFactory = await ethers.getContractFactory("KETH");
        keth = await kethFactory.deploy(weth.address, kora.address);
    })

    it("can deposit and withdraw ETH", async function() {
        await owner.sendTransaction({ to: keth.address, value: 5 });
        expect(await keth.balanceOf(owner.address)).to.equal(5);
        expect(await keth.totalSupply()).to.equal(5);

        await keth.connect(owner).deposit({ value: 6 });
        expect(await keth.balanceOf(owner.address)).to.equal(11);
        expect(await keth.totalSupply()).to.equal(11);

        await weth.connect(owner).deposit({ value: 7 });
        expect(await weth.balanceOf(owner.address)).to.equal(7);
        await expect(keth.depositTokens(7)).to.be.revertedWith("weth c: not enough allowance");
        await weth.approve(keth.address, 7);
        await keth.depositTokens(7);
        expect(await weth.balanceOf(owner.address)).to.equal(0);
        expect(await keth.balanceOf(owner.address)).to.equal(18);
        expect(await keth.totalSupply()).to.equal(18);

        await keth.connect(owner).withdrawTokens(3);
        expect(await weth.balanceOf(owner.address)).to.equal(3);
        expect(await keth.balanceOf(owner.address)).to.equal(15);
        expect(await keth.totalSupply()).to.equal(15);

        await keth.connect(owner).withdraw(4);
        expect(await weth.balanceOf(owner.address)).to.equal(3);
        expect(await keth.balanceOf(owner.address)).to.equal(11);
        expect(await keth.totalSupply()).to.equal(11);

        await expect(keth.connect(owner).withdraw(12)).to.be.revertedWith("ERC20: burn amount exceeds balance");
    });
})