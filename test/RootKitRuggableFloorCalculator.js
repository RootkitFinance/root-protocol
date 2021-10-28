const { expect } = require("chai");
const { constants } = require("ethers");
const { ethers } = require("hardhat");

describe("RootKitRuggableFloorCalculator", function() {
    let owner, user1;
    let rootKitRuggableFloorCalculator;

    beforeEach(async function() {
        [owner, user1] = await ethers.getSigners();
        const rootKitRuggableFloorCalculatorFactory = await ethers.getContractFactory("RootKitRuggableFloorCalculator");
        rootKitRuggableFloorCalculator = await rootKitRuggableFloorCalculatorFactory.connect(owner).deploy();
    })

    it("owner-only functions don't work for non-owner", async function() {
        await expect(rootKitRuggableFloorCalculator.connect(user1).setSubFloor(0)).to.be.revertedWith("Owner only");
    })

    it("calculateSubFloor returns whatever setSubFloor sets", async function() {
        expect(await rootKitRuggableFloorCalculator.calculateSubFloor(constants.AddressZero, constants.AddressZero)).to.equal(0);
        await rootKitRuggableFloorCalculator.connect(owner).setSubFloor(1);
        expect(await rootKitRuggableFloorCalculator.calculateSubFloor(constants.AddressZero, constants.AddressZero)).to.equal(1);
        await rootKitRuggableFloorCalculator.connect(owner).setSubFloor(3);
        expect(await rootKitRuggableFloorCalculator.calculateSubFloor(constants.AddressZero, constants.AddressZero)).to.equal(3);
    })
})