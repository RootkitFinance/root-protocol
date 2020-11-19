const { ethers } = require("hardhat");
const { utils } = require("ethers");
const { expect } = require("chai");

describe("RootKit", function() {
    let rootKit, owner;

    beforeEach(async function() {
        [owner] = await ethers.getSigners();
        const rootKitFactory = await ethers.getContractFactory("RootKit");
        rootKit = await rootKitFactory.connect(owner).deploy();
    })

    it("initialized correctly", async function() {
        expect(await rootKit.name()).to.equal("RootKit");
        expect(await rootKit.symbol()).to.equal("ROOT");
        expect(await rootKit.decimals()).to.equal(18);
        expect(await rootKit.totalSupply()).to.equal(utils.parseEther("10000"));
        expect(await rootKit.balanceOf(owner.address)).to.equal(utils.parseEther("10000"));
    })
});