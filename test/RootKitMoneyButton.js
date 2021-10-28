const { expect } = require("chai");
const { constants, utils, BigNumber } = require("ethers");
const { ethers } = require("hardhat");
const { createWETH, createUniswap } = require("./helpers.js");

describe("RootKitMoneyButton", function() {
    let owner, user1, vault;
    let rootKitMoneyButton;
    let weth, keth, uniswap, erc20, rootKit;

    beforeEach(async function() {
        [owner, user1, vault] = await ethers.getSigners();
        const rootKitMoneyButtonFactory = await ethers.getContractFactory("RootKitMoneyButton");
        weth = await createWETH();
        uniswap = await createUniswap(owner, weth);
        const kethFactory = await ethers.getContractFactory("KETH");
        keth = await kethFactory.connect(owner).deploy(weth.address);
        rootKitMoneyButton = await rootKitMoneyButtonFactory.connect(owner).deploy(uniswap.router.address, keth.address);
        const erc20Factory = await ethers.getContractFactory("ERC20Test");
        erc20 = await erc20Factory.connect(owner).deploy();
        const rootKitFactory = await ethers.getContractFactory("RootKit");
        rootKit = await rootKitFactory.connect(owner).deploy();
        await erc20.connect(owner).approve(uniswap.router.address, constants.MaxUint256);
        await keth.connect(owner).approve(uniswap.router.address, constants.MaxUint256);
        await weth.connect(owner).approve(uniswap.router.address, constants.MaxUint256);
        await rootKit.connect(owner).approve(uniswap.router.address, constants.MaxUint256);
    })

    it("initializes as expected", async function() {
        expect(await rootKitMoneyButton.vault()).to.equal(constants.AddressZero);
        expect(await rootKitMoneyButton.percentToVault()).to.equal(0);
    })

    it("owner-only functions can't be called by non-owner", async function() {
        await expect(rootKitMoneyButton.connect(user1).configure(constants.AddressZero, 0)).to.be.revertedWith("Owner only");
    })

    describe("Configured 10% to vault", function() {
        beforeEach(async function() {
            await rootKitMoneyButton.connect(owner).configure(vault.address, 1000);
        })

        describe("1 WETH = 10 ERC20 ... 1 ERC20 = 1 ROOT ... 1 ROOT = 1 KETH", function() {
            beforeEach(async function() {
                await owner.sendTransaction({ to: weth.address, value: utils.parseEther("1") });
                await owner.sendTransaction({ to: keth.address, value: utils.parseEther("1") });
                await uniswap.router.addLiquidity(weth.address, erc20.address, utils.parseEther("1"), utils.parseEther("10"), 0, 0, owner.address, 2e9);
                await uniswap.router.addLiquidity(erc20.address, rootKit.address, utils.parseEther("1"), utils.parseEther("1"), 0, 0, owner.address, 2e9);
                await uniswap.router.addLiquidity(rootKit.address, keth.address, utils.parseEther("1"), utils.parseEther("1"), 0, 0, owner.address, 2e9);
            })
    
            it("0.1 WETH -> ERC20 -> ROOT -> KETH, min profit 0", async function() {
                const path = [weth.address, erc20.address, rootKit.address, keth.address];
                const amt = utils.parseEther("0.1");
                const minProfit = utils.parseEther("0");

                const estimatedProfit = BigNumber.from(await rootKitMoneyButton.estimateProfit(path, amt));

                await user1.sendTransaction({ to: weth.address, value: amt });
                await weth.connect(user1).approve(rootKitMoneyButton.address, constants.MaxUint256);
                await rootKitMoneyButton.connect(user1).gimmeMoney(path, amt, minProfit);

                const user1Balance = BigNumber.from(await weth.balanceOf(user1.address));
                const vaultBalance = BigNumber.from(await weth.balanceOf(vault.address));
                expect(user1Balance.add(vaultBalance).sub(amt).eq(estimatedProfit)).to.equal(true);
                expect(user1Balance.sub(amt).gte(minProfit)).to.equal(true);
                expect(vaultBalance.eq(estimatedProfit.div(10))).to.equal(true);
            })
    
            it("0.1 WETH -> ERC20 -> ROOT -> KETH, min profit 0.25", async function() {
                const path = [weth.address, erc20.address, rootKit.address, keth.address];
                const amt = utils.parseEther("0.1");
                const minProfit = utils.parseEther("0.25");

                await user1.sendTransaction({ to: weth.address, value: amt });
                await weth.connect(user1).approve(rootKitMoneyButton.address, constants.MaxUint256);
                await expect(rootKitMoneyButton.connect(user1).gimmeMoney(path, amt, minProfit)).to.be.revertedWith("Not enough profit");
            })
    
            it("0.1 KETH -> ROOT -> ERC20 -> WETH, min profit 0", async function() {
                const path = [keth.address, rootKit.address, erc20.address, weth.address];
                const amt = utils.parseEther("0.1");
                const minProfit = utils.parseEther("0");

                const estimatedProfit = BigNumber.from(await rootKitMoneyButton.estimateProfit(path, amt));
                expect(estimatedProfit.isZero()).to.equal(true);

                await user1.sendTransaction({ to: keth.address, value: amt });
                await keth.connect(user1).approve(rootKitMoneyButton.address, constants.MaxUint256);
                await expect(rootKitMoneyButton.connect(user1).gimmeMoney(path, amt, minProfit)).to.be.revertedWith("Not enough profit");
            })
    
            it("0.1 ETH -> WETH -> ERC20 -> ROOT -> KETH, min profit 0", async function() {
                const path = [constants.AddressZero, weth.address, erc20.address, rootKit.address, keth.address];
                const amt = utils.parseEther("0.1");
                const minProfit = utils.parseEther("0");

                const estimatedProfit = BigNumber.from(await rootKitMoneyButton.estimateProfit(path, amt));

                const previousUser1Balance = BigNumber.from(await ethers.provider.getBalance(user1.address));
                const previousVaultBalance = BigNumber.from(await ethers.provider.getBalance(vault.address));
                await rootKitMoneyButton.connect(user1).gimmeMoney(path, amt, minProfit, { value: amt, gasPrice: 0 });

                const user1Balance = BigNumber.from(await ethers.provider.getBalance(user1.address));
                const vaultBalance = BigNumber.from(await ethers.provider.getBalance(vault.address));
                expect(user1Balance.add(vaultBalance).sub(previousVaultBalance).sub(previousUser1Balance).eq(estimatedProfit)).to.equal(true);
                expect(user1Balance.sub(previousUser1Balance).gte(minProfit)).to.equal(true);
            })
    
            it("sending eth fails if path[0] != eth", async function() {
                const path = [weth.address, erc20.address, rootKit.address, keth.address];
                const amt = utils.parseEther("0.1");
                const minProfit = utils.parseEther("0");

                await user1.sendTransaction({ to: weth.address, value: amt });
                await weth.connect(user1).approve(rootKitMoneyButton.address, constants.MaxUint256);
                await expect(rootKitMoneyButton.connect(user1).gimmeMoney(path, amt, minProfit, { value: 1 })).to.be.revertedWith("Send ETH if and only if the path starts with ETH");
            })
        })
    })
})