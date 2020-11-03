const { ethers } = require("hardhat");
const { utils } = require("ethers");
const { expect } = require("chai");

describe("Kora", function() {
    let kora, owner;

    beforeEach(async function() {
        [owner] = await ethers.getSigners();
        const koraFactory = await ethers.getContractFactory("Kora");
        kora = await koraFactory.connect(owner).deploy();
    })

    it("initialized correctly", async function() {
        expect(await kora.name()).to.equal("Kora");
        expect(await kora.symbol()).to.equal("KORA");
        expect(await kora.decimals()).to.equal(18);
        expect(await kora.totalSupply()).to.equal(utils.parseEther("10000"));
        expect(await kora.balanceOf(owner.address)).to.equal(utils.parseEther("10000"));
    })
});