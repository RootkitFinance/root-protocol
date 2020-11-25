const { ethers } = require("hardhat");
const { utils, constants } = require("ethers");
const { createWETH, createUniswap } = require("./helpers");
const { expect } = require("chai");
const { parseEther } = require("ethers/lib/utils");

describe("LiquidityLockedERC20", async function() {
    let owner, user1;
    let liquidityLockedERC20, uniswap, weth, wethErc20;

    beforeEach(async function() {
        [owner, user1] = await ethers.getSigners();
        const liquidityLockedERC20Factory = await ethers.getContractFactory("LiquidityLockedERC20Test");
        liquidityLockedERC20 = await liquidityLockedERC20Factory.connect(owner).deploy();
        weth = await createWETH();
        uniswap = await createUniswap(owner, weth);
        await uniswap.factory.createPair(weth.address, liquidityLockedERC20.address);
        wethErc20 = uniswap.pairFor(await uniswap.factory.getPair(weth.address, liquidityLockedERC20.address));
        await weth.connect(owner).approve(uniswap.router.address, constants.MaxUint256);
        await weth.connect(user1).approve(uniswap.router.address, constants.MaxUint256);
        await wethErc20.connect(owner).approve(uniswap.router.address, constants.MaxUint256);
        await wethErc20.connect(user1).approve(uniswap.router.address, constants.MaxUint256);
        await liquidityLockedERC20.connect(owner).approve(uniswap.router.address, constants.MaxUint256);
        await liquidityLockedERC20.connect(user1).approve(uniswap.router.address, constants.MaxUint256);
        await weth.connect(owner).deposit({ value: parseEther("50") });
        await weth.connect(user1).deposit({ value: parseEther("50") });
    })

    it("owner only functions can't be called by non-owners", async function() {
        await expect(liquidityLockedERC20.connect(user1).setLiquidityController(wethErc20.address, true)).to.be.revertedWith("Owner only");
    })
    it("controller only functions can't be called by non-controller", async function() {
        await expect(liquidityLockedERC20.connect(owner).setLiquidityLock(wethErc20.address, true)).to.be.revertedWith("Liquidity controller only");
    })

    it("initializes as expected", async function() {
        expect(await liquidityLockedERC20.liquidityPairLocked(wethErc20.address)).to.equal(false);
        expect(await liquidityLockedERC20.liquidityController(owner.address)).to.equal(false);
    })

    describe("Liquidity for wethErc20 locked", async function() {
        beforeEach(async function() {
            await liquidityLockedERC20.connect(owner).setLiquidityController(owner.address, true);
            await liquidityLockedERC20.connect(owner).setLiquidityLock(wethErc20.address, true);
        })

        it("initializes as expected", async function() {
            expect(await liquidityLockedERC20.liquidityPairLocked(wethErc20.address)).to.equal(true);
            expect(await liquidityLockedERC20.liquidityController(owner.address)).to.equal(true);
        })

        it("Can't add liquidity", async function() {
            const amt = utils.parseEther("10");
            await expect(uniswap.router.connect(owner).addLiquidity(weth.address, liquidityLockedERC20.address, amt, amt, amt, amt, owner.address, 2e9)).to.be.revertedWith("Liquidity is locked");
        });

        it("Can't add liquidity manually", async function() {
            const amt = utils.parseEther("10");
            await weth.connect(owner).transfer(wethErc20.address, amt);
            await liquidityLockedERC20.connect(owner).transfer(wethErc20.address, amt);
            await expect(wethErc20.connect(owner).mint(owner.address)).to.be.revertedWith("Liquidity is locked");

            await liquidityLockedERC20.connect(owner).transferFrom(owner.address, wethErc20.address, 0);
            await expect(wethErc20.connect(owner).mint(owner.address)).to.be.revertedWith("Liquidity is locked");
        });

        describe("Liquidity added", async function() {
            const amt = utils.parseEther("1");

            beforeEach(async function() {
                const amt = utils.parseEther("10");
                await liquidityLockedERC20.connect(owner).setLiquidityLock(wethErc20.address, false);
                await uniswap.router.connect(owner).addLiquidity(weth.address, liquidityLockedERC20.address, amt, amt, amt, amt, owner.address, 2e9);
                await liquidityLockedERC20.connect(owner).setLiquidityLock(wethErc20.address, true);
            })

            it("Can't add more liquidity", async function() {
                const amt = utils.parseEther("10");
                await expect(uniswap.router.connect(owner).addLiquidity(weth.address, liquidityLockedERC20.address, amt, amt, amt, amt, owner.address, 2e9)).to.be.revertedWith("Liquidity is locked");
            })

            it("Can buy", async function() {
                await uniswap.router.connect(owner).swapExactTokensForTokens(amt, 0, [weth.address, liquidityLockedERC20.address], owner.address, 2e9);
                await uniswap.router.connect(owner).swapExactTokensForTokens(amt, 0, [weth.address, liquidityLockedERC20.address], owner.address, 2e9);
                await uniswap.router.connect(owner).swapExactTokensForTokensSupportingFeeOnTransferTokens(amt, 0, [weth.address, liquidityLockedERC20.address], owner.address, 2e9);
                await uniswap.router.connect(owner).swapExactTokensForTokensSupportingFeeOnTransferTokens(amt, 0, [weth.address, liquidityLockedERC20.address], owner.address, 2e9);
                await uniswap.router.connect(owner).swapExactTokensForTokens(amt, 0, [weth.address, liquidityLockedERC20.address], owner.address, 2e9);
            })

            it("Can sell", async function() {
                await uniswap.router.connect(owner).swapExactTokensForTokens(amt, 0, [liquidityLockedERC20.address, weth.address], owner.address, 2e9);
                await uniswap.router.connect(owner).swapExactTokensForTokens(amt, 0, [liquidityLockedERC20.address, weth.address], owner.address, 2e9);
                await uniswap.router.connect(owner).swapExactTokensForTokensSupportingFeeOnTransferTokens(amt, 0, [liquidityLockedERC20.address, weth.address], owner.address, 2e9);
                await uniswap.router.connect(owner).swapExactTokensForTokensSupportingFeeOnTransferTokens(amt, 0, [liquidityLockedERC20.address, weth.address], owner.address, 2e9);
                await uniswap.router.connect(owner).swapExactTokensForTokens(amt, 0, [liquidityLockedERC20.address, weth.address], owner.address, 2e9);
            })

            it("Can't remove liquidity", async function() {
                await expect(uniswap.router.connect(owner).removeLiquidity(weth.address, liquidityLockedERC20.address, await wethErc20.balanceOf(owner.address), 0, 0, owner.address, 2e9)).to.be.revertedWith("Liquidity is locked");

                await uniswap.router.connect(owner).swapExactTokensForTokens(amt, 0, [weth.address, liquidityLockedERC20.address], owner.address, 2e9);
                await expect(uniswap.router.connect(owner).removeLiquidity(weth.address, liquidityLockedERC20.address, await wethErc20.balanceOf(owner.address), 0, 0, owner.address, 2e9)).to.be.revertedWith("Liquidity is locked");

                await uniswap.router.connect(owner).swapExactTokensForTokens(amt, 0, [liquidityLockedERC20.address, weth.address], owner.address, 2e9);
                await expect(uniswap.router.connect(owner).removeLiquidity(weth.address, liquidityLockedERC20.address, await wethErc20.balanceOf(owner.address), 0, 0, owner.address, 2e9)).to.be.revertedWith("Liquidity is locked");
            })
        })
    })
})