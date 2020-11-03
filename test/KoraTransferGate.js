const { expect } = require("chai");
const { constants, utils } = require("ethers");
const { ethers } = require("hardhat");
const { createUniswap, createWETH } = require("./helpers");

describe("KoraTransferGate", function() {
    let kora, koraTransferGate, owner, dev, user1, keth, uniswap, kethKora;

    beforeEach(async function() {
        [owner, dev, user1] = await ethers.getSigners();
        const koraFactory = await ethers.getContractFactory("Kora");
        kora = await koraFactory.connect(owner).deploy();
        const koraTransferGateFactory = await ethers.getContractFactory("KoraTransferGate");
        const weth = await createWETH();
        uniswap = await createUniswap(owner, weth);
        koraTransferGate = await koraTransferGateFactory.connect(owner).deploy(kora.address, uniswap.router.address);
        await kora.connect(owner).setTransferGate(koraTransferGate.address);
        const kethFactory = await ethers.getContractFactory("KETH");
        keth = await kethFactory.connect(owner).deploy(weth.address, kora.address);
        await uniswap.factory.createPair(kora.address, keth.address);
        const kethKoraAddress = await uniswap.factory.getPair(kora.address, keth.address);
        kethKora = uniswap.pairFor(kethKoraAddress);
    });

    it("initialized as expected", async function() {
        const p = await koraTransferGate.parameters();
        expect(p.dev).to.equal(constants.AddressZero);
        expect(p.poolRate).to.equal(0);
        expect(p.burnRate).to.equal(0);
        expect(p.devRate).to.equal(0);
        expect(await koraTransferGate.allowedPoolTokensCount()).to.equal(0);
    })

    it("setParameters fails for non-owner", async function() {
        await expect(koraTransferGate.connect(dev).setParameters(dev.address, 100, 200, 400)).to.be.revertedWith("Owner only");
    })

    it("transfer works as expected", async function() {
        await kora.connect(owner).transfer(user1.address, utils.parseEther("100"));
        expect(await kora.totalSupply()).to.equal(utils.parseEther("10000"));
        expect(await kora.balanceOf(owner.address)).to.equal(utils.parseEther("9900"));
        expect(await kora.balanceOf(user1.address)).to.equal(utils.parseEther("100"));
        expect(await kora.balanceOf(koraTransferGate.address)).to.equal(utils.parseEther("0"));
        expect(await kora.balanceOf(dev.address)).to.equal(utils.parseEther("0"));
    });

    it("addLiquidity to keth/kora fails", async function() {
        await kora.connect(owner).approve(uniswap.router.address, utils.parseEther("0.0001"));
        await keth.connect(owner).approve(uniswap.router.address, utils.parseEther("0.0001"));
        await keth.connect(owner).deposit({ value: utils.parseEther("0.0001") });
        await expect(uniswap.router.connect(owner).addLiquidity(keth.address, kora.address, utils.parseEther("0.0001"), utils.parseEther("0.0001"), 0, 0, owner.address, 2e9)).to.be.revertedWith("TransferHelper: TRANSFER_FROM_FAILED");
    });

    it("allowPool fails from non-owner", async function() {
        await expect(koraTransferGate.connect(user1).allowPool(keth.address)).to.be.revertedWith("Owner only");
    })

    it("setFreeParticipant fails from non-owner", async function() {
        await expect(koraTransferGate.connect(user1).setFreeParticipant(user1.address, true)).to.be.revertedWith("Owner only");
    })

    it("unrestricted controlled as expected", async function() {
        await expect(koraTransferGate.connect(user1).setUnrestrictedController(user1.address, true)).to.be.revertedWith("Owner only");
        expect(await koraTransferGate.unrestrictedControllers(user1.address)).to.equal(false);
        expect(await koraTransferGate.unrestricted()).to.equal(false);
        await koraTransferGate.connect(owner).setUnrestrictedController(user1.address, true);
        await expect(koraTransferGate.connect(owner).setUnrestricted(true)).to.be.revertedWith();
        await koraTransferGate.connect(user1).setUnrestricted(true);
        expect(await koraTransferGate.unrestrictedControllers(user1.address)).to.equal(true);
        expect(await koraTransferGate.unrestricted()).to.equal(true);
        
        await kora.connect(owner).approve(uniswap.router.address, utils.parseEther("0.0001"));
        await keth.connect(owner).approve(uniswap.router.address, utils.parseEther("0.0001"));
        await keth.connect(owner).deposit({ value: utils.parseEther("0.0001") });
        await uniswap.router.connect(owner).addLiquidity(keth.address, kora.address, utils.parseEther("0.0001"), utils.parseEther("0.0001"), 0, 0, owner.address, 2e9);
        const lp = await kethKora.balanceOf(owner.address);
        await kethKora.connect(owner).approve(uniswap.router.address, lp);
        await uniswap.router.connect(owner).removeLiquidity(keth.address, kora.address, lp, 0, 0, owner.address, 2e9);

        await koraTransferGate.connect(user1).setUnrestricted(false);
        expect(await koraTransferGate.unrestricted()).to.equal(false);
    });

    describe("setParameters(dev, pool 1%, burn 2%, dev 4%)", function() {
        beforeEach(async function() {
            await koraTransferGate.connect(owner).setParameters(dev.address, 100, 200, 400);
        })

        it("sets parameters as expected", async function() {
            const p = await koraTransferGate.parameters();
            expect(p.dev).to.equal(dev.address);
            expect(p.poolRate).to.equal(100);
            expect(p.burnRate).to.equal(200);
            expect(p.devRate).to.equal(400);            
        })

        it("transfer works as expected", async function() {
            await kora.connect(owner).transfer(user1.address, utils.parseEther("100"));
            expect(await kora.totalSupply()).to.equal(utils.parseEther("9998"));
            expect(await kora.balanceOf(owner.address)).to.equal(utils.parseEther("9900"));
            expect(await kora.balanceOf(user1.address)).to.equal(utils.parseEther("93"));
            expect(await kora.balanceOf(koraTransferGate.address)).to.equal(utils.parseEther("1"));
            expect(await kora.balanceOf(dev.address)).to.equal(utils.parseEther("4"));
        });

        describe("setFreeParticipant(owner)", function() {
            beforeEach(async function() {
                await koraTransferGate.connect(owner).setFreeParticipant(owner.address, true);
            })

            it("sets as expected", async function() {
                expect(await koraTransferGate.freeParticipant(owner.address)).to.equal(true);
                await koraTransferGate.connect(owner).setFreeParticipant(owner.address, false);
                expect(await koraTransferGate.freeParticipant(owner.address)).to.equal(false);
            })

            it("transfer works as expected", async function() {
                await kora.connect(owner).transfer(user1.address, utils.parseEther("100"));
                expect(await kora.totalSupply()).to.equal(utils.parseEther("10000"));
                expect(await kora.balanceOf(owner.address)).to.equal(utils.parseEther("9900"));
                expect(await kora.balanceOf(user1.address)).to.equal(utils.parseEther("100"));
                expect(await kora.balanceOf(koraTransferGate.address)).to.equal(utils.parseEther("0"));
                expect(await kora.balanceOf(dev.address)).to.equal(utils.parseEther("0"));
            });
        })

        describe("allowPool(keth)", function() {
            beforeEach(async function() {
                await koraTransferGate.connect(owner).allowPool(keth.address);
            })

            it("sets allowedPoolTokens as expected", async function() {
                expect(await koraTransferGate.allowedPoolTokensCount()).to.equal(1);
                expect(await koraTransferGate.allowedPoolTokens(0)).to.equal(keth.address);
            })
        
            it("add/remove keth/kora Liquidity works as expected", async function() {
                await kora.connect(owner).approve(uniswap.router.address, utils.parseEther("0.0001"));
                await keth.connect(owner).approve(uniswap.router.address, utils.parseEther("0.0001"));
                await keth.connect(owner).deposit({ value: utils.parseEther("0.0001") });
                await uniswap.router.connect(owner).addLiquidity(keth.address, kora.address, utils.parseEther("0.0001"), utils.parseEther("0.0001"), 0, 0, owner.address, 2e9);                
                
                // No easy way to stop a mint/burn combo with nothing in between
                await kora.connect(owner).transfer(owner.address, 0);

                await kethKora.connect(owner).approve(uniswap.router.address, constants.MaxUint256);
                const lp = await kethKora.balanceOf(owner.address);
                await expect(uniswap.router.connect(owner).removeLiquidity(keth.address, kora.address, lp, 0, 0, owner.address, 2e9)).to.be.revertedWith("UniswapV2: TRANSFER_FAILED");
            });
        })
    })    
});