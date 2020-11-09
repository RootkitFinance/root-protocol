const { ethers } = require("hardhat");
const { utils } = require("ethers");

const UniswapV2PairJson = require('../contracts/json/UniswapV2Pair.json');
const UniswapV2FactoryJson = require('../contracts/json/UniswapV2Factory.json');
const UniswapV2Router02Json = require('../contracts/json/UniswapV2Router02.json');
const UniswapV2LibraryJson = require('../contracts/json/UniswapV2Library.json');

exports.createWETH = async function() {
    const wethFactory = await ethers.getContractFactory("WETH9");
    return await wethFactory.deploy();
}
exports.createUniswap = async function(owner, weth) {
    const erc20Factory = await ethers.getContractFactory("ERC20Test");
    const wbtc = await erc20Factory.connect(owner).deploy();
    const factory = await new ethers.ContractFactory(UniswapV2FactoryJson.abi, UniswapV2FactoryJson.bytecode, owner).deploy(owner.address);
    const router = await new ethers.ContractFactory(UniswapV2Router02Json.abi, UniswapV2Router02Json.bytecode, owner).deploy(factory.address, weth.address);
    const library = await new ethers.ContractFactory(UniswapV2LibraryJson.abi, UniswapV2LibraryJson.bytecode, owner).deploy();
    const amt = utils.parseEther("10");
    await owner.sendTransaction({ to: weth.address, value: amt });
    await weth.connect(owner).approve(router.address, amt);
    await wbtc.connect(owner).approve(router.address, amt);
    await router.connect(owner).addLiquidity(wbtc.address, weth.address, amt, amt, amt, amt, owner.address, 2e9);
    return {
        factory,
        router,
        library,
        wbtc,
        pairFor: address => new ethers.Contract(address, UniswapV2PairJson.abi, owner)
    };
}