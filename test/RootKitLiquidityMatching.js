const { expect } = require("chai");
const { utils, constants } = require("ethers");
const { parseEther } = require("ethers/lib/utils");
const { ethers } = require("hardhat");
const { createWETH, createUniswap } = require("./helpers");


describe("RootKitLiquidityMatching", function() {
    let owner, user1;
    let weth, keth, rootKitLiquidityMatching, kethRootKit, wrappedKethRootKit, rootKit;

    beforeEach(async function() {
        [owner, user1] = await ethers.getSigners();
        weth = await createWETH();
        const uniswap = await createUniswap(owner, weth);
        const kethFactory = await ethers.getContractFactory("KETH");
        keth = await kethFactory.connect(owner).deploy(weth.address);
        const rootKitFactory = await ethers.getContractFactory("RootKit");
        rootKit = await rootKitFactory.connect(owner).deploy();
        await uniswap.factory.createPair(keth.address, rootKit.address);
        kethRootKit = uniswap.pairFor(await uniswap.factory.getPair(keth.address, rootKit.address));
        const rootKitLiquidityFactory = await ethers.getContractFactory("RootKitLiquidity");
        wrappedKethRootKit = await rootKitLiquidityFactory.connect(owner).deploy(kethRootKit.address, "a", "b");
        const rootKitLiquidityMatchingFactory = await ethers.getContractFactory("RootKitLiquidityMatching");
        rootKitLiquidityMatching = await rootKitLiquidityMatchingFactory.connect(owner).deploy(rootKit.address, uniswap.router.address, wrappedKethRootKit.address, keth.address);

        await keth.connect(user1).approve(rootKitLiquidityMatching.address, constants.MaxUint256);
        await weth.connect(user1).approve(rootKitLiquidityMatching.address, constants.MaxUint256);
    })

    it("initializes as expected", async function() {
        expect(await rootKitLiquidityMatching.liquidityPercentForUser()).to.equal(5000);
    })

    it("owner-only functions can't be called by non-owner", async function() {
        await expect(rootKitLiquidityMatching.connect(user1).setLiquidityPercentForUser(40)).to.be.revertedWith("Owner only");
    })

    it("setLiquidityPercent works as expected", async function() {
        await rootKitLiquidityMatching.connect(owner).setLiquidityPercentForUser(6000);
        expect(await rootKitLiquidityMatching.liquidityPercentForUser()).to.equal(6000);
    })

    describe("rootKitLiquidityMatching has 1 ROOT", function() {
        const amt = utils.parseEther("1");
        beforeEach(async function() {
            await rootKit.connect(owner).transfer(rootKitLiquidityMatching.address, utils.parseEther("1"));
        })

        it("addLiquidityETH first takes all", async function() {
            await rootKitLiquidityMatching.connect(user1).addLiquidityETH({ value: amt });
            expect(await keth.totalSupply()).to.equal(amt);
            expect(await rootKit.balanceOf(kethRootKit.address)).not.to.equal(0);
            expect(await keth.balanceOf(kethRootKit.address)).not.to.equal(0);
            expect(await kethRootKit.balanceOf(rootKitLiquidityMatching.address)).to.equal(await wrappedKethRootKit.balanceOf(user1.address));
        })
    
        it("addLiquidityWETH first takes all", async function() {
            await weth.connect(user1).deposit({ value: amt });
            await rootKitLiquidityMatching.connect(user1).addLiquidityWETH(amt);
            expect(await rootKit.balanceOf(kethRootKit.address)).to.equal(amt);
            expect(await keth.balanceOf(kethRootKit.address)).to.equal(amt);
            expect(await kethRootKit.balanceOf(rootKitLiquidityMatching.address)).to.equal(await wrappedKethRootKit.balanceOf(user1.address));
            expect(await weth.balanceOf(user1.address)).to.equal(0);
        })
    
        it("addLiquidityKETH first takes all", async function() {
            await keth.connect(user1).deposit({ value: amt });
            await rootKitLiquidityMatching.connect(user1).addLiquidityKETH(amt);
            expect(await keth.totalSupply()).to.equal(amt);
            expect(await rootKit.balanceOf(kethRootKit.address)).to.equal(amt);
            expect(await keth.balanceOf(kethRootKit.address)).to.equal(amt);
            expect(await kethRootKit.balanceOf(rootKitLiquidityMatching.address)).to.equal(await wrappedKethRootKit.balanceOf(user1.address));
            expect(await keth.balanceOf(user1.address)).to.equal(0);
        })

        describe("1 ETH + 1 ROOT liquidity added, 10 more ROOT in rootKitLiquidityMatching", function() {
            beforeEach(async function() {
                await rootKitLiquidityMatching.connect(user1).addLiquidityETH({ value: utils.parseEther("1") });
                await rootKit.connect(owner).transfer(rootKitLiquidityMatching.address, utils.parseEther("10"));
            })

            it("Adding 1 more ETH uses 1 ROOT, takes all ETH", async function() {    
                const balanceBefore = await ethers.provider.getBalance(user1.address);
                await rootKitLiquidityMatching.connect(user1).addLiquidityETH({ value: amt, gasPrice: 0 });
                const balanceAfter = await ethers.provider.getBalance(user1.address);
                expect(balanceBefore.sub(amt).eq(balanceAfter)).to.equal(true);
                expect(await keth.totalSupply()).to.equal(amt.mul(2));
                expect(await rootKit.balanceOf(kethRootKit.address)).to.equal(amt.mul(2));
                expect(await keth.balanceOf(kethRootKit.address)).to.equal(amt.mul(2));
            })

            it("Adding 1 more WETH uses 1 ROOT, takes all WETH", async function() {    
                await weth.connect(user1).deposit({ value: amt });
                const balanceBefore = await weth.balanceOf(user1.address);
                await rootKitLiquidityMatching.connect(user1).addLiquidityWETH(amt);
                const balanceAfter = await weth.balanceOf(user1.address);
                expect(balanceBefore.sub(amt).eq(balanceAfter)).to.equal(true);
                expect(await rootKit.balanceOf(kethRootKit.address)).to.equal(amt.mul(2));
                expect(await keth.balanceOf(kethRootKit.address)).to.equal(amt.mul(2));
            })

            it("Adding 1 more KETH uses 1 ROOT, takes all KETH", async function() {    
                await keth.connect(user1).deposit({ value: amt });
                const balanceBefore = await keth.balanceOf(user1.address);
                await rootKitLiquidityMatching.connect(user1).addLiquidityKETH(amt);
                const balanceAfter = await keth.balanceOf(user1.address);
                expect(balanceBefore.sub(amt).eq(balanceAfter)).to.equal(true);
                expect(await keth.totalSupply()).to.equal(amt.mul(2));
                expect(await rootKit.balanceOf(kethRootKit.address)).to.equal(amt.mul(2));
                expect(await keth.balanceOf(kethRootKit.address)).to.equal(amt.mul(2));
            })

            it("Adding 100 more ETH uses 10 ROOT, takes 10 ETH, returns the rest", async function() {    
                const amt2 = utils.parseEther("100");
                const balanceBefore = await ethers.provider.getBalance(user1.address);
                await rootKitLiquidityMatching.connect(user1).addLiquidityETH({ value: amt2, gasPrice: 0 });
                const balanceAfter = await ethers.provider.getBalance(user1.address);
                expect(balanceBefore.sub(utils.parseEther("10")).eq(balanceAfter)).to.equal(true);
                expect(await keth.totalSupply()).to.equal(utils.parseEther("11"));
                expect(await rootKit.balanceOf(kethRootKit.address)).to.equal(utils.parseEther("11"));
                expect(await keth.balanceOf(kethRootKit.address)).to.equal(utils.parseEther("11"));
            })

            it("Adding 100 more WETH uses 10 ROOT, takes 10 WETH, returns the rest", async function() {    
                const amt2 = utils.parseEther("100");  
                await weth.connect(user1).deposit({ value: amt2 });
                const balanceBefore = await weth.balanceOf(user1.address);
                await rootKitLiquidityMatching.connect(user1).addLiquidityWETH(amt2);
                const balanceAfter = await weth.balanceOf(user1.address);
                expect(balanceBefore.sub(utils.parseEther("10")).eq(balanceAfter)).to.equal(true);
                expect(await rootKit.balanceOf(kethRootKit.address)).to.equal(utils.parseEther("11"));
                expect(await keth.balanceOf(kethRootKit.address)).to.equal(utils.parseEther("11"));
            })

            it("Adding 100 more KETH uses 10 ROOT, takes 10 KETH, returns the rest", async function() {    
                const amt2 = utils.parseEther("100");  
                await keth.connect(user1).deposit({ value: amt2 });
                const balanceBefore = await keth.balanceOf(user1.address);
                await rootKitLiquidityMatching.connect(user1).addLiquidityKETH(amt2);
                const balanceAfter = await keth.balanceOf(user1.address);
                expect(balanceBefore.sub(utils.parseEther("10")).eq(balanceAfter)).to.equal(true);
                expect(await keth.totalSupply()).to.equal(utils.parseEther("101"));
                expect(await rootKit.balanceOf(kethRootKit.address)).to.equal(utils.parseEther("11"));
                expect(await keth.balanceOf(kethRootKit.address)).to.equal(utils.parseEther("11"));
            })
        })
    })
})