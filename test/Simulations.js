const { ethers } = require("hardhat");
const { utils, constants } = require("ethers");
const { createWETH, createUniswap } = require("./helpers.js");
const { expect } = require("chai");

describe("Simulations", function() {
    let owner, vault, user1, user2, user3, user4, user5;
    let erc20Factory, erc31337Factory, kethFactory;
    let rootKitFactory, rootKitDistributionFactory, rootKitFloorCalculatorFactory, rootKitTransferGateFactory, rootKitLiquidityFactory;
    let weth, uniswap;
    
    beforeEach(async function() {
        [owner, vault, user1, user2, user3, user4, user5] = await ethers.getSigners();
        erc20Factory = await ethers.getContractFactory("ERC20Test");
        erc31337Factory = await ethers.getContractFactory("ERC31337");
        kethFactory = await ethers.getContractFactory("KETH");
        rootKitFactory = await ethers.getContractFactory("RootKit");
        rootKitDistributionFactory = await ethers.getContractFactory("RootKitDistribution");
        rootKitFloorCalculatorFactory = await ethers.getContractFactory("RootKitFloorCalculator");
        rootKitTransferGateFactory = await ethers.getContractFactory("RootKitTransferGate");
        rootKitLiquidityFactory = await ethers.getContractFactory("RootKitLiquidity");
        weth = await createWETH();
        uniswap = await createUniswap(owner, weth);
    })

    it("General scenario", async function() {

        ////////////////////////////////
        // Initial setup
        ////////////////////////////////

        // deploy RootKit, RootKitTransferGate, RootKitFloorCalculator, KETH, RootKitDistribution
        const rootKit = await rootKitFactory.connect(owner).deploy();
        const rootKitTransferGate = await rootKitTransferGateFactory.deploy(rootKit.address, uniswap.router.address);
        const rootKitFloorCalculator = await rootKitFloorCalculatorFactory.deploy(rootKit.address, uniswap.factory.address);
        const keth = await kethFactory.connect(owner).deploy(weth.address);
        const rootKitDistribution = await rootKitDistributionFactory.deploy(rootKit.address, uniswap.router.address, keth.address, uniswap.wbtc.address, vault.address);

        // Start rootKitDistribution setup
        await rootKitDistribution.connect(owner).setup1();
        await rootKitDistribution.connect(owner).setup2();

        // Create wrapped liquidity tokens for KETH/ROOT and WBTC/ROOT
        const kethRootKit = uniswap.pairFor(await uniswap.factory.getPair(keth.address, rootKit.address));
        const wrappedKethRootKit = await rootKitLiquidityFactory.connect(owner).deploy(kethRootKit.address);
        const wbtcRootKit = uniswap.pairFor(await uniswap.factory.getPair(uniswap.wbtc.address, rootKit.address));
        const wrappedWbtcRootKit = await rootKitLiquidityFactory.connect(owner).deploy(wbtcRootKit.address);

        // Finish rootKitDistribution setup
        await rootKitDistribution.connect(owner).setup3(wrappedKethRootKit.address, wrappedWbtcRootKit.address);

        // transfer all KIT to rootKitDistribution
        await rootKit.connect(owner).transfer(rootKitDistribution.address, utils.parseEther("10000"));
        // add transfer gate into rootKit
        await rootKit.connect(owner).setTransferGate(rootKitTransferGate.address);
        // add floor calculator into keth
        await keth.connect(owner).setFloorCalculator(rootKitFloorCalculator.address);
        // make rootKitDistribution a keth sweeper
        await keth.connect(owner).setSweeper(rootKitDistribution.address, true)
        // make rootKitDistribution an unrestricted controller on the transfer gate
        await rootKitTransferGate.connect(owner).setUnrestrictedController(rootKitDistribution.address, true);

        ////////////////////////////////
        // Start the sale
        ////////////////////////////////

        await rootKitDistribution.connect(owner).activate();

        // People send 150 in total ETH
        await user1.sendTransaction({ to: rootKitDistribution.address, value: utils.parseEther("10") });
        await user2.sendTransaction({ to: rootKitDistribution.address, value: utils.parseEther("20") });
        await user3.sendTransaction({ to: rootKitDistribution.address, value: utils.parseEther("30") });
        await user4.sendTransaction({ to: rootKitDistribution.address, value: utils.parseEther("40") });
        await user5.sendTransaction({ to: rootKitDistribution.address, value: utils.parseEther("50") });

        // Complete the sale with 1 jenga
        await rootKitDistribution.connect(owner).complete(0);

        // User1 gets 10 KETH
        await keth.connect(user1).deposit({ value: utils.parseEther("10") });
        // User2 has 10 WBTC
        await uniswap.wbtc.connect(owner).transfer(user2.address, utils.parseEther("10"));

        // User1 wants to buy some ROOT using KETH
        // But it fails because the KETH/ROOT pool isn't allowed yet
        await keth.connect(user1).approve(uniswap.router.address, constants.MaxUint256);
        await expect(
            uniswap.router.connect(user1).swapExactTokensForTokens(utils.parseEther("1"), 0, [keth.address, rootKit.address], user1.address, 2e9)
            ).to.be.revertedWith("UniswapV2: TRANSFER_FAILED");

        // User2 wants to buy some ROOT using WBTC
        // But it fails because the WBTC/ROOT pool isn't allowed yet
        await uniswap.wbtc.connect(user2).approve(uniswap.router.address, constants.MaxUint256);
        await expect(
            uniswap.router.connect(user2).swapExactTokensForTokens(utils.parseEther("1"), 0, [uniswap.wbtc.address, rootKit.address], user2.address, 2e9)
            ).to.be.revertedWith("UniswapV2: TRANSFER_FAILED");

        // User3 calls claim()
        // But it fails because we haven't called distribute() yet
        await expect(
            rootKitDistribution.connect(user3).claim()
            ).to.be.revertedWith("Distribution not complete");

        // Graciously allow the KETH/ROOT pool
        await rootKitTransferGate.connect(owner).allowPool(keth.address);

        // User1 buys some ROOT using KETH
        expect(await rootKit.balanceOf(user1.address)).to.equal("0");
        await uniswap.router.connect(user1).swapExactTokensForTokens(utils.parseEther("1"), 0, [keth.address, rootKit.address], user1.address, 2e9);
        expect(await rootKit.balanceOf(user1.address)).not.to.equal("0");
        
        // User2 wants to buy some ROOT using WBTC
        // But it fails because the WBTC/ROOT pool still isn't allowed yet
        await expect(
            uniswap.router.connect(user2).swapExactTokensForTokens(utils.parseEther("1"), 0, [uniswap.wbtc.address, rootKit.address], user2.address, 2e9)
            ).to.be.revertedWith("UniswapV2: TRANSFER_FAILED");
        
        // Graciously allow the WBTC/ROOT pool
        await rootKitTransferGate.connect(owner).allowPool(uniswap.wbtc.address);

        // User2 buys some ROOT using WBTC
        expect(await rootKit.balanceOf(user2.address)).to.equal("0");
        await uniswap.router.connect(user2).swapExactTokensForTokens(utils.parseEther("1"), 0, [uniswap.wbtc.address, rootKit.address], user2.address, 2e9)
        expect(await rootKit.balanceOf(user2.address)).not.to.equal("0");

        // Call distribute() to allow people to claim liquidity tokens and prepurchased RootKit
        await rootKitDistribution.connect(owner).distribute();

        // Everyone calls claim() to get their wrapped liquidity tokens and prepurchased RootKit
        await rootKitDistribution.connect(user1).claim();
        await rootKitDistribution.connect(user2).claim();
        await rootKitDistribution.connect(user3).claim();
        await rootKitDistribution.connect(user4).claim();
        expect(await wrappedKethRootKit.balanceOf(user5.address)).to.equal("0");
        expect(await wrappedWbtcRootKit.balanceOf(user5.address)).to.equal("0");
        await rootKitDistribution.connect(user5).claim();
        expect(await rootKit.balanceOf(user5.address)).not.to.equal("0");
        expect(await wrappedKethRootKit.balanceOf(user5.address)).not.to.equal("0");
        expect(await wrappedWbtcRootKit.balanceOf(user5.address)).not.to.equal("0");
        
        // User1 sells all their ROOT for KETH
        let user1KethBalance = await keth.balanceOf(user1.address);
        await rootKit.connect(user1).approve(uniswap.router.address, constants.MaxUint256);
        await uniswap.router.connect(user1).swapExactTokensForTokens(await rootKit.balanceOf(user1.address), 0, [rootKit.address, keth.address], user1.address, 2e9);
        expect(await rootKit.balanceOf(user1.address)).to.equal("0");
        expect(await keth.balanceOf(user1.address)).not.to.equal(user1KethBalance);

        // User2 sells all their ROOT for WBTC
        let user2WbtcBalance = await uniswap.wbtc.balanceOf(user2.address);
        await rootKit.connect(user2).approve(uniswap.router.address, constants.MaxUint256);
        await uniswap.router.connect(user2).swapExactTokensForTokens(await rootKit.balanceOf(user2.address), 0, [rootKit.address, uniswap.wbtc.address], user2.address, 2e9);
        expect(await rootKit.balanceOf(user2.address)).to.equal("0");
        expect(await uniswap.wbtc.balanceOf(user2.address)).not.to.equal(user2WbtcBalance);

        // User3 sends all their ROOT to User1
        // User1 receives 100% of it because we haven't set up transfer gate parameters
        let user3RootKitBalance = await rootKit.balanceOf(user3.address);
        let devRootKitBalance = await rootKit.balanceOf(owner.address);
        let vaultRootKitBalance = await rootKit.balanceOf(vault.address);
        let rootKitSupply = await rootKit.totalSupply();
        await rootKit.connect(user3).transfer(user1.address, user3RootKitBalance);
        expect(await rootKit.balanceOf(user3.address)).to.equal("0");
        expect(await rootKit.balanceOf(user1.address)).to.equal(user3RootKitBalance);
        expect(await rootKit.balanceOf(owner.address)).to.equal(devRootKitBalance);
        expect(await rootKit.balanceOf(vault.address)).to.equal(vaultRootKitBalance);
        expect(await rootKit.totalSupply()).to.equal(rootKitSupply);

        // Set up the transfer gate parameters
        // 1% to vault
        // 2% to burn
        // 3% to dev
        await rootKitTransferGate.connect(owner).setParameters(owner.address, vault.address, 100, 200, 300);

        // User4 sends 100 ROOT to User2
        let user4RootKitBalance = await rootKit.balanceOf(user4.address);
        devRootKitBalance = await rootKit.balanceOf(owner.address);
        vaultRootKitBalance = await rootKit.balanceOf(vault.address);
        rootKitSupply = await rootKit.totalSupply();
        console.log("BEFORE USER4 ROOT Balance: " + utils.formatEther(user4RootKitBalance));
        console.log("BEFORE DEV ROOT Balance: " + utils.formatEther(devRootKitBalance));
        console.log("BEFORE VAULT ROOT Balance: " + utils.formatEther(vaultRootKitBalance));
        console.log("BEFORE ROOT Supply: " + utils.formatEther(rootKitSupply));
        await rootKit.connect(user4).transfer(user2.address, utils.parseEther("100"));
        expect(await rootKit.balanceOf(user4.address)).not.to.equal(user4RootKitBalance);
        expect(await rootKit.balanceOf(user2.address)).not.to.equal(user4RootKitBalance);
        expect(await rootKit.balanceOf(owner.address)).not.to.equal(devRootKitBalance);
        expect(await rootKit.balanceOf(vault.address)).not.to.equal(vaultRootKitBalance);
        expect(await rootKit.totalSupply()).not.to.equal(rootKitSupply);
        console.log("AFTER USER4 ROOT Balance: " + utils.formatEther(await rootKit.balanceOf(user4.address)));
        console.log("AFTER USER2 ROOT Balance: " + utils.formatEther(await rootKit.balanceOf(user2.address)));
        console.log("AFTER DEV ROOT Balance: " + utils.formatEther(await rootKit.balanceOf(owner.address)));
        console.log("AFTER VAULT ROOT Balance: " + utils.formatEther(await rootKit.balanceOf(vault.address)));
        console.log("AFTER ROOT Supply: " + utils.formatEther(await rootKit.totalSupply()));
    })
});