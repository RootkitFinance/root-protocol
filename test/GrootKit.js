const { ethers } = require("hardhat");
const { utils } = require("ethers");
const { expect } = require("chai");

describe("GrootKit", function() {
    let grootKit, owner;

    beforeEach(async function() {
        [owner] = await ethers.getSigners();
        const grootKitFactory = await ethers.getContractFactory("GrootKit");
        grootKit = await grootKitFactory.connect(owner).deploy();
    })

    it("initialized correctly", async function() {
        expect(await grootKit.name()).to.equal("GrootKit");
        expect(await grootKit.symbol()).to.equal("GROOT");
        expect(await grootKit.decimals()).to.equal(18);
        expect(await grootKit.totalSupply()).to.equal(utils.parseEther("1000000"));
        expect(await grootKit.balanceOf(owner.address)).to.equal(utils.parseEther("1000000"));
    })
});