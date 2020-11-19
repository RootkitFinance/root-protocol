const { expect } = require("chai");
const { constants } = require("ethers");
const { ethers } = require("hardhat");

describe("RootKitStaking", function() {
    let owner, user1, user2;
    let rootKit, erc20a, erc20b;
    let rootKitStaking;

    beforeEach(async function() {
        [owner, user1, user2] = await ethers.getSigners();
        const rootKitFactory = await ethers.getContractFactory("RootKit");
        const erc20Factory = await ethers.getContractFactory("ERC20Test");
        const rootKitStakingFactory = await ethers.getContractFactory("RootKitStaking");
        rootKit = await rootKitFactory.connect(owner).deploy();
        erc20a = await erc20Factory.connect(owner).deploy();
        erc20b = await erc20Factory.connect(owner).deploy();
        rootKitStaking = await rootKitStakingFactory.connect(owner).deploy(rootKit.address);
    })

    it("initializes as expected", async function() {
        expect(await rootKitStaking.rewardToken()).to.equal(rootKit.address);
        expect(await rootKitStaking.totalAllocationPoints()).to.equal(0);
        expect(await rootKitStaking.poolInfoCount()).to.equal(0);
    })

    it("owner only functions can't be called by non-owner", async function() {
        await expect(rootKitStaking.connect(user1).addPool(0, constants.AddressZero)).to.be.revertedWith("Owner only");
        await expect(rootKitStaking.connect(user1).setPoolAllocationPoints(0, 0)).to.be.revertedWith("Owner only");
    })

    describe("addPool(10, ERC20-a)", function() {
        beforeEach(async function() {
            await rootKitStaking.connect(owner).addPool(10, erc20a.address);
        })

        it("initializes as expected", async function() {
            expect(await rootKitStaking.totalAllocationPoints()).to.equal(10);
            expect(await rootKitStaking.poolInfoCount()).to.equal(1);
            expect((await rootKitStaking.poolInfo(0)).token).to.equal(erc20a.address);
            expect((await rootKitStaking.poolInfo(0)).allocationPoints).to.equal(10);
            expect((await rootKitStaking.poolInfo(0)).accRewardPerShare).to.equal(0);
            expect(await rootKitStaking.pendingReward(0, constants.AddressZero)).to.equal(0);
        })

        it("Can't be re-added", async function() {
            await expect(rootKitStaking.connect(owner).addPool(10, erc20a.address)).to.be.revertedWith("Pool exists");
        })

        it("setPoolAllocationPoints works", async function() {
            await rootKitStaking.connect(owner).setPoolAllocationPoints(0, 5);
            expect(await rootKitStaking.totalAllocationPoints()).to.equal(5);
            expect(await rootKitStaking.poolInfoCount()).to.equal(1);
            expect((await rootKitStaking.poolInfo(0)).token).to.equal(erc20a.address);
            expect((await rootKitStaking.poolInfo(0)).allocationPoints).to.equal(5);
            expect((await rootKitStaking.poolInfo(0)).accRewardPerShare).to.equal(0);
        })

        it("withdraw(0,0) doesn't do anything", async function() {
            await rootKitStaking.connect(user1).withdraw(0, 0);
        })

        it("withdraw(0,1) fails", async function() {
            await expect(rootKitStaking.connect(user1).withdraw(0, 1)).to.be.revertedWith("Amount more than staked");
        })

        it("deposit fails without approval", async function() {
            await expect(rootKitStaking.connect(user1).deposit(0, 1000)).to.be.revertedWith();
        })

        describe("user1 deposit(0, 1000)", function() {
            beforeEach(async function() {
                await erc20a.connect(owner).transfer(user1.address, 1000);
                await erc20a.connect(user1).approve(rootKitStaking.address, 1000);
                await rootKitStaking.connect(user1).deposit(0, 1000);
            })

            it("initializes as expected", async function() {
                expect((await rootKitStaking.userInfo(0, user1.address)).amountStaked).to.equal(1000);
                expect((await rootKitStaking.userInfo(0, user1.address)).rewardDebt).to.equal(0);
                expect(await erc20a.balanceOf(user1.address)).to.equal(0);
                expect(await erc20a.balanceOf(rootKitStaking.address)).to.equal(1000);
            })

            it("withdraw(0, 0) works as expected", async function() {
                await rootKitStaking.connect(user1).withdraw(0, 0);
                expect((await rootKitStaking.userInfo(0, user1.address)).amountStaked).to.equal(1000);
                expect((await rootKitStaking.userInfo(0, user1.address)).rewardDebt).to.equal(0);
                expect(await erc20a.balanceOf(user1.address)).to.equal(0);
                expect(await erc20a.balanceOf(rootKitStaking.address)).to.equal(1000);
            })

            it("withdraw(0, 100) works as expected", async function() {
                await rootKitStaking.connect(user1).withdraw(0, 100);
                expect((await rootKitStaking.userInfo(0, user1.address)).amountStaked).to.equal(900);
                expect((await rootKitStaking.userInfo(0, user1.address)).rewardDebt).to.equal(0);
                expect(await erc20a.balanceOf(user1.address)).to.equal(100);
                expect(await erc20a.balanceOf(rootKitStaking.address)).to.equal(900);
            })

            it("withdraw(0, 1000) works as expected", async function() {
                await rootKitStaking.connect(user1).withdraw(0, 1000);
                expect((await rootKitStaking.userInfo(0, user1.address)).amountStaked).to.equal(0);
                expect((await rootKitStaking.userInfo(0, user1.address)).rewardDebt).to.equal(0);
                expect(await erc20a.balanceOf(user1.address)).to.equal(1000);
                expect(await erc20a.balanceOf(rootKitStaking.address)).to.equal(0);
            })

            it("emergencyWithdrawal works as expected", async function() {
                await rootKitStaking.connect(user1).emergencyWithdraw(0);
                expect((await rootKitStaking.userInfo(0, user1.address)).amountStaked).to.equal(0);
                expect((await rootKitStaking.userInfo(0, user1.address)).rewardDebt).to.equal(0);
                expect(await erc20a.balanceOf(user1.address)).to.equal(1000);
                expect(await erc20a.balanceOf(rootKitStaking.address)).to.equal(0);
            })

            describe("1000 reward tokens added", function() {
                beforeEach(async function() {
                    await rootKit.connect(owner).transfer(rootKitStaking.address, 1000);
                })

                it("initializes as expected", async function() {
                    expect(await rootKitStaking.pendingReward(0, user1.address)).to.equal(1000);
                    expect(await rootKitStaking.pendingReward(0, user2.address)).to.equal(0);
                })

                it("withdraw(0, 0) works as expected", async function() {
                    await rootKitStaking.connect(user1).withdraw(0, 0);
                    expect((await rootKitStaking.userInfo(0, user1.address)).amountStaked).to.equal(1000);
                    expect((await rootKitStaking.userInfo(0, user1.address)).rewardDebt).to.equal(1000);
                    expect(await erc20a.balanceOf(user1.address)).to.equal(0);
                    expect(await erc20a.balanceOf(rootKitStaking.address)).to.equal(1000);
                    expect(await rootKit.balanceOf(user1.address)).to.equal(1000);
                    
                    await rootKitStaking.connect(user1).withdraw(0, 0);
                    expect((await rootKitStaking.userInfo(0, user1.address)).amountStaked).to.equal(1000);
                    expect((await rootKitStaking.userInfo(0, user1.address)).rewardDebt).to.equal(1000);
                    expect(await erc20a.balanceOf(user1.address)).to.equal(0);
                    expect(await erc20a.balanceOf(rootKitStaking.address)).to.equal(1000);
                    expect(await rootKit.balanceOf(user1.address)).to.equal(1000);
                })
    
                it("withdraw(0, 100) works as expected", async function() {
                    await rootKitStaking.connect(user1).withdraw(0, 100);
                    expect((await rootKitStaking.userInfo(0, user1.address)).amountStaked).to.equal(900);
                    expect((await rootKitStaking.userInfo(0, user1.address)).rewardDebt).to.equal(900);
                    expect(await erc20a.balanceOf(user1.address)).to.equal(100);
                    expect(await erc20a.balanceOf(rootKitStaking.address)).to.equal(900);
                    expect(await rootKit.balanceOf(user1.address)).to.equal(1000);
                    
                    await rootKitStaking.connect(user1).withdraw(0, 100);
                    expect((await rootKitStaking.userInfo(0, user1.address)).amountStaked).to.equal(800);
                    expect((await rootKitStaking.userInfo(0, user1.address)).rewardDebt).to.equal(800);
                    expect(await erc20a.balanceOf(user1.address)).to.equal(200);
                    expect(await erc20a.balanceOf(rootKitStaking.address)).to.equal(800);
                    expect(await rootKit.balanceOf(user1.address)).to.equal(1000);
                })
    
                it("withdraw(0, 1000) works as expected", async function() {
                    await rootKitStaking.connect(user1).withdraw(0, 1000);
                    expect((await rootKitStaking.userInfo(0, user1.address)).amountStaked).to.equal(0);
                    expect((await rootKitStaking.userInfo(0, user1.address)).rewardDebt).to.equal(0);
                    expect(await erc20a.balanceOf(user1.address)).to.equal(1000);
                    expect(await erc20a.balanceOf(rootKitStaking.address)).to.equal(0);
                    expect(await rootKit.balanceOf(user1.address)).to.equal(1000);
                    
                    await expect(rootKitStaking.connect(user1).withdraw(0, 1)).to.be.revertedWith("Amount more than staked");
                })
    
                it("emergencyWithdrawal works as expected", async function() {
                    await rootKitStaking.connect(user1).emergencyWithdraw(0);
                    expect((await rootKitStaking.userInfo(0, user1.address)).amountStaked).to.equal(0);
                    expect((await rootKitStaking.userInfo(0, user1.address)).rewardDebt).to.equal(0);
                    expect(await erc20a.balanceOf(user1.address)).to.equal(1000);
                    expect(await erc20a.balanceOf(rootKitStaking.address)).to.equal(0);
                    expect(await rootKit.balanceOf(user1.address)).to.equal(0);
                })

                describe("user2 deposit(0, 1000)", function() {
                    beforeEach(async function() {
                        await erc20a.connect(owner).transfer(user2.address, 1000);
                        await erc20a.connect(user2).approve(rootKitStaking.address, 1000);
                        await rootKitStaking.connect(user2).deposit(0, 1000);
                    })

                    it("Initializes as expected", async function() {
                        expect(await rootKitStaking.pendingReward(0, user1.address)).to.equal(1000);
                        expect(await rootKitStaking.pendingReward(0, user2.address)).to.equal(0);                        
                        expect((await rootKitStaking.userInfo(0, user2.address)).amountStaked).to.equal(1000);
                        expect((await rootKitStaking.userInfo(0, user2.address)).rewardDebt).to.equal(1000);
                        expect(await erc20a.balanceOf(user2.address)).to.equal(0);
                        expect(await erc20a.balanceOf(rootKitStaking.address)).to.equal(2000);
                    })
                    
                    it("withdraw(0, 0) works as expected", async function() {
                        await rootKitStaking.connect(user1).withdraw(0, 0);
                        expect((await rootKitStaking.userInfo(0, user1.address)).amountStaked).to.equal(1000);
                        expect((await rootKitStaking.userInfo(0, user1.address)).rewardDebt).to.equal(1000);
                        expect(await erc20a.balanceOf(user1.address)).to.equal(0);
                        expect(await erc20a.balanceOf(rootKitStaking.address)).to.equal(2000);
                        expect(await rootKit.balanceOf(user1.address)).to.equal(1000);
                        
                        await rootKitStaking.connect(user1).withdraw(0, 0);
                        expect((await rootKitStaking.userInfo(0, user1.address)).amountStaked).to.equal(1000);
                        expect((await rootKitStaking.userInfo(0, user1.address)).rewardDebt).to.equal(1000);
                        expect(await erc20a.balanceOf(user1.address)).to.equal(0);
                        expect(await erc20a.balanceOf(rootKitStaking.address)).to.equal(2000);
                        expect(await rootKit.balanceOf(user1.address)).to.equal(1000);
                    })
        
                    it("withdraw(0, 100) works as expected", async function() {
                        await rootKitStaking.connect(user1).withdraw(0, 100);
                        expect((await rootKitStaking.userInfo(0, user1.address)).amountStaked).to.equal(900);
                        expect((await rootKitStaking.userInfo(0, user1.address)).rewardDebt).to.equal(900);
                        expect(await erc20a.balanceOf(user1.address)).to.equal(100);
                        expect(await erc20a.balanceOf(rootKitStaking.address)).to.equal(1900);
                        expect(await rootKit.balanceOf(user1.address)).to.equal(1000);
                        
                        await rootKitStaking.connect(user1).withdraw(0, 100);
                        expect((await rootKitStaking.userInfo(0, user1.address)).amountStaked).to.equal(800);
                        expect((await rootKitStaking.userInfo(0, user1.address)).rewardDebt).to.equal(800);
                        expect(await erc20a.balanceOf(user1.address)).to.equal(200);
                        expect(await erc20a.balanceOf(rootKitStaking.address)).to.equal(1800);
                        expect(await rootKit.balanceOf(user1.address)).to.equal(1000);
                    })
        
                    it("withdraw(0, 1000) works as expected", async function() {
                        await rootKitStaking.connect(user1).withdraw(0, 1000);
                        expect((await rootKitStaking.userInfo(0, user1.address)).amountStaked).to.equal(0);
                        expect((await rootKitStaking.userInfo(0, user1.address)).rewardDebt).to.equal(0);
                        expect(await erc20a.balanceOf(user1.address)).to.equal(1000);
                        expect(await erc20a.balanceOf(rootKitStaking.address)).to.equal(1000);
                        expect(await rootKit.balanceOf(user1.address)).to.equal(1000);
                        
                        await expect(rootKitStaking.connect(user1).withdraw(0, 1)).to.be.revertedWith("Amount more than staked");
                    })

                    describe("500 more rewards added", function() {
                        beforeEach(async function() {
                            await rootKit.connect(owner).transfer(rootKitStaking.address, 500);
                        })

                        it("initializes as expected", async function() {
                            expect(await rootKitStaking.pendingReward(0, user1.address)).to.equal(1250);
                            expect(await rootKitStaking.pendingReward(0, user2.address)).to.equal(250);
                        })

                        it("withdrawals work as expected", async function() {
                            await rootKitStaking.connect(user1).withdraw(0, 1000);
                            await rootKitStaking.connect(user2).withdraw(0, 1000);

                            expect (await rootKit.balanceOf(user1.address)).to.equal(1250);
                            expect (await rootKit.balanceOf(user2.address)).to.equal(250);
                            expect (await erc20a.balanceOf(user1.address)).to.equal(1000);
                            expect (await erc20a.balanceOf(user2.address)).to.equal(1000);
                            expect((await rootKitStaking.userInfo(0, user1.address)).amountStaked).to.equal(0);
                            expect((await rootKitStaking.userInfo(0, user1.address)).rewardDebt).to.equal(0);
                            expect((await rootKitStaking.userInfo(0, user2.address)).amountStaked).to.equal(0);
                            expect((await rootKitStaking.userInfo(0, user2.address)).rewardDebt).to.equal(0);
                        })

                        it("deposits work as expected", async function() {
                            await rootKitStaking.connect(user1).deposit(0, 0);
                            await rootKitStaking.connect(user2).deposit(0, 0);
                            expect(await rootKitStaking.pendingReward(0, user1.address)).to.equal(0);
                            expect(await rootKitStaking.pendingReward(0, user2.address)).to.equal(0);
                            expect (await rootKit.balanceOf(user1.address)).to.equal(1250);
                            expect (await rootKit.balanceOf(user2.address)).to.equal(250);

                            await rootKitStaking.connect(user1).withdraw(0, 1000);
                            await rootKitStaking.connect(user2).withdraw(0, 1000);

                            expect (await erc20a.balanceOf(user1.address)).to.equal(1000);
                            expect (await erc20a.balanceOf(user2.address)).to.equal(1000);
                            expect((await rootKitStaking.userInfo(0, user1.address)).amountStaked).to.equal(0);
                            expect((await rootKitStaking.userInfo(0, user1.address)).rewardDebt).to.equal(0);
                            expect((await rootKitStaking.userInfo(0, user2.address)).amountStaked).to.equal(0);
                            expect((await rootKitStaking.userInfo(0, user2.address)).rewardDebt).to.equal(0);
                        })

                        describe("addPool(30, ERC20-b)", function() {
                            beforeEach(async function() {
                                await rootKitStaking.connect(owner).addPool(30, erc20b.address);
                            })

                            it("initializes as expected", async function() {
                                expect(await rootKitStaking.pendingReward(0, user1.address)).to.equal(1250);
                                expect(await rootKitStaking.pendingReward(0, user2.address)).to.equal(250);
                                expect(await rootKitStaking.pendingReward(1, user1.address)).to.equal(0);
                                expect(await rootKitStaking.pendingReward(1, user2.address)).to.equal(0);
                                expect(await rootKitStaking.totalAllocationPoints()).to.equal(40);
                                expect(await rootKitStaking.poolInfoCount()).to.equal(2);
                                expect((await rootKitStaking.poolInfo(1)).token).to.equal(erc20b.address);
                                expect((await rootKitStaking.poolInfo(1)).allocationPoints).to.equal(30);
                                expect((await rootKitStaking.poolInfo(1)).accRewardPerShare).to.equal(0);
                                expect(await rootKitStaking.pendingReward(1, constants.AddressZero)).to.equal(0);
                            })

                            describe("user1 and user2 both deposit 1000 into new pool", async function() {
                                beforeEach(async function() {
                                    await erc20b.connect(owner).transfer(user1.address, 1000);
                                    await erc20b.connect(owner).transfer(user2.address, 1000);
                                    await erc20b.connect(user1).approve(rootKitStaking.address, 1000);
                                    await erc20b.connect(user2).approve(rootKitStaking.address, 1000);
                                    await rootKitStaking.connect(user1).deposit(1, 1000);
                                    await rootKitStaking.connect(user2).deposit(1, 1000);
                                })

                                it("initializes as expected", async function() {
                                    expect(await rootKitStaking.pendingReward(0, user1.address)).to.equal(1250);
                                    expect(await rootKitStaking.pendingReward(0, user2.address)).to.equal(250);
                                    expect(await rootKitStaking.pendingReward(1, user1.address)).to.equal(0);
                                    expect(await rootKitStaking.pendingReward(1, user2.address)).to.equal(0);
                                })

                                it("withdrawals work as expected", async function() {
                                    await rootKitStaking.connect(user1).withdraw(0, 1000);
                                    await rootKitStaking.connect(user2).withdraw(0, 1000);
        
                                    expect (await rootKit.balanceOf(user1.address)).to.equal(1250);
                                    expect (await rootKit.balanceOf(user2.address)).to.equal(250);
                                    expect (await erc20a.balanceOf(user1.address)).to.equal(1000);
                                    expect (await erc20a.balanceOf(user2.address)).to.equal(1000);
                                    expect((await rootKitStaking.userInfo(0, user1.address)).amountStaked).to.equal(0);
                                    expect((await rootKitStaking.userInfo(0, user1.address)).rewardDebt).to.equal(0);
                                    expect((await rootKitStaking.userInfo(0, user2.address)).amountStaked).to.equal(0);
                                    expect((await rootKitStaking.userInfo(0, user2.address)).rewardDebt).to.equal(0);
                                })
                                
                                describe("1000 more rewards added", function() {
                                    beforeEach(async function() {
                                        await rootKit.connect(owner).transfer(rootKitStaking.address, 1000);
                                    })

                                    it("initializes as expected", async function() {
                                        expect(await rootKitStaking.pendingReward(0, user1.address)).to.equal(1375);
                                        expect(await rootKitStaking.pendingReward(0, user2.address)).to.equal(375);
                                        expect(await rootKitStaking.pendingReward(1, user1.address)).to.equal(375);
                                        expect(await rootKitStaking.pendingReward(1, user2.address)).to.equal(375);
                                    })

                                    it("withdrawals work as expected", async function() {
                                        await rootKitStaking.connect(user1).withdraw(0, 1000);
                                        await rootKitStaking.connect(user2).withdraw(0, 1000);
                                        await rootKitStaking.connect(user1).withdraw(1, 1000);
                                        await rootKitStaking.connect(user2).withdraw(1, 1000);
            
                                        expect (await rootKit.balanceOf(user1.address)).to.equal(1750);
                                        expect (await rootKit.balanceOf(user2.address)).to.equal(750);
                                        expect (await erc20a.balanceOf(user1.address)).to.equal(1000);
                                        expect (await erc20a.balanceOf(user2.address)).to.equal(1000);
                                        expect (await erc20b.balanceOf(user1.address)).to.equal(1000);
                                        expect (await erc20b.balanceOf(user2.address)).to.equal(1000);
                                        expect((await rootKitStaking.userInfo(0, user1.address)).amountStaked).to.equal(0);
                                        expect((await rootKitStaking.userInfo(0, user1.address)).rewardDebt).to.equal(0);
                                        expect((await rootKitStaking.userInfo(0, user2.address)).amountStaked).to.equal(0);
                                        expect((await rootKitStaking.userInfo(0, user2.address)).rewardDebt).to.equal(0);
                                        expect((await rootKitStaking.userInfo(1, user1.address)).amountStaked).to.equal(0);
                                        expect((await rootKitStaking.userInfo(1, user1.address)).rewardDebt).to.equal(0);
                                        expect((await rootKitStaking.userInfo(1, user2.address)).amountStaked).to.equal(0);
                                        expect((await rootKitStaking.userInfo(1, user2.address)).rewardDebt).to.equal(0);
                                    })                                    
                                }) 
                            })
                        })
                    })
                })
            })
        })
    })
})