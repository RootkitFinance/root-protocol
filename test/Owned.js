const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("Owned", function() {
    let owned, owner, user1;

    beforeEach(async function() {
        [owner, user1] = await ethers.getSigners();
        const ownedFactory = await ethers.getContractFactory("OwnedTest");
        owned = await ownedFactory.connect(owner).deploy();
    })

    it("owner starts as creator", async function() {
       expect(await owned.owner()).to.equal(owner.address);
    })

    it("transferOwnership works", async function() {
        await owned.connect(owner).transferOwnership(user1.address);
    })
    it("transferOwnership fails for non-owner", async function() {
        await expect(owned.connect(user1).transferOwnership(user1.address)).to.be.revertedWith("Owner only");
    })

    describe("transferOwnership(user1)", function() {
        beforeEach(async function() {
            await owned.connect(owner).transferOwnership(user1.address);
        })

        it("claimOwnership from non-user1 fails", async function() {
            await expect(owned.connect(owner).claimOwnership()).to.be.revertedWith();
        })

        it("claimOwnership for user1 makes user1 owner", async function() {
            await owned.connect(user1).claimOwnership();
            expect(await owned.owner()).to.equal(user1.address);
        })

        it("claimOwnership emits OwnedshipTransferred", async function() {
            await expect(owned.connect(user1).claimOwnership()).to.emit(owned, "OwnershipTransferred").withArgs(owner.address, user1.address);
        })
    })
})