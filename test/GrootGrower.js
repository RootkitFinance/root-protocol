const { expect } = require("chai");
const { utils, constants } = require("ethers");
const { parseEther } = require("ethers/lib/utils");
const { ethers } = require("hardhat");
const { createWETH, createUniswap } = require("./helpers");

describe("GrootGrower", function() {
    let owner, user1;
    let uniswap, weth, grootKit, grootGrower, wethGroot;

    beforeEach(async function() {
        [owner, user1] = await ethers.getSigners();
        weth = await createWETH();
        uniswap = await createUniswap(owner, weth);
        const grootKitFactory = await ethers.getContractFactory("GrootKit");
        grootKit = await grootKitFactory.connect(owner).deploy();
        await uniswap.factory.createPair(grootKit.address, weth.address);
        const grootGrowerFactory = await ethers.getContractFactory("GrootGrower");
        grootGrower = await grootGrowerFactory.connect(owner).deploy(grootKit.address, weth.address, uniswap.router.address);        
        wethGroot = uniswap.pairFor(await uniswap.factory.getPair(grootKit.address, weth.address));
        await grootKit.connect(owner).setLiquidityController(owner.address, true);
        await grootKit.connect(owner).setLiquidityController(grootGrower.address, true);
    })

    it("initializes correctly", async function() {
        const parameters = await grootGrower.parameters();
        expect(parameters.nextGrowTimestamp).to.equal(0);
        expect(parameters.growInterval).to.equal(0);
        expect(parameters.redeemPercent).to.equal(0);
        expect(parameters.buyPercent).to.equal(0);
    })

    it("owner-only functions can't be called by non-owner", async function() {
        await expect(grootGrower.connect(user1).setParameters(0,0,0)).to.be.revertedWith("Owner only");
    });

    describe("Liquidity added, sent to groot grower", function() {
        const startingWeth = utils.parseEther("10");
        const startingGroot = utils.parseEther("1000000");
        beforeEach(async function() {
            await weth.connect(owner).deposit({ value: startingWeth });
            await weth.connect(owner).approve(uniswap.router.address, constants.MaxUint256);
            await grootKit.connect(owner).approve(uniswap.router.address, constants.MaxUint256);
            await uniswap.router.connect(owner).addLiquidity(weth.address, grootKit.address, startingWeth, startingGroot, 0, 0, grootGrower.address, 2e9);
            await grootKit.connect(owner).setLiquidityLock(wethGroot.address, true);
        })

        describe("setParameters(1, 9900, 260)", function() {
            beforeEach(async function() {
                await grootGrower.connect(owner).setParameters(1, 9900, 260);
            })

            it("initializes correctly", async function() {
                const parameters = await grootGrower.parameters();
                expect(parameters.nextGrowTimestamp).not.to.equal(0);
                expect(parameters.growInterval).to.equal(1);
                expect(parameters.redeemPercent).to.equal(9900);
                expect(parameters.buyPercent).to.equal(260);
            })

            it("grow() works", async function() {
                await grootGrower.connect(user1).grow();
                await grootGrower.connect(user1).grow();
                await grootGrower.connect(user1).grow();
                await grootGrower.connect(user1).grow();
                await grootGrower.connect(user1).grow();
                await grootGrower.connect(user1).grow();
                await grootGrower.connect(user1).grow();
                console.log("WETH:  " + utils.formatEther(await weth.balanceOf(grootGrower.address)));
                console.log("Groot: " + utils.formatEther(await grootKit.balanceOf(grootGrower.address)));
            })
        })

        describe("setParameters(100, 9900, 260)", function() {
            beforeEach(async function() {
                await grootGrower.connect(owner).setParameters(100, 9900, 260);
            })

            it("initializes correctly", async function() {
                const parameters = await grootGrower.parameters();
                expect(parameters.nextGrowTimestamp).not.to.equal(0);
                expect(parameters.growInterval).to.equal(100);
                expect(parameters.redeemPercent).to.equal(9900);
                expect(parameters.buyPercent).to.equal(260);
            })

            it("grow() doesn't work until enough time has passed", async function() {
                await expect(grootGrower.connect(user1).grow()).to.be.revertedWith("Too early to grow");
                await ethers.provider.send("evm_increaseTime", [100]);
                await grootGrower.connect(user1).grow();
                await expect(grootGrower.connect(user1).grow()).to.be.revertedWith("Too early to grow");
                await ethers.provider.send("evm_increaseTime", [100]);
                await grootGrower.connect(user1).grow();
                await expect(grootGrower.connect(user1).grow()).to.be.revertedWith("Too early to grow");
                await ethers.provider.send("evm_increaseTime", [100]);
                await grootGrower.connect(user1).grow();
                await expect(grootGrower.connect(user1).grow()).to.be.revertedWith("Too early to grow");
            })
        })
    })
})