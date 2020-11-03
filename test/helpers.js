const { ethers } = require("hardhat");


//const UniswapV2OracleLibraryJson = require('../contracts/json/UniswapV2OracleLibrary.json');

const UniswapV2PairJson = require('../contracts/json/UniswapV2Pair.json');
const UniswapV2FactoryJson = require('../contracts/json/UniswapV2Factory.json');
const UniswapV2Router02Json = require('../contracts/json/UniswapV2Router02.json');
const UniswapV2LibraryJson = require('../contracts/json/UniswapV2Library.json');

exports.createWETH = async function() {
    const wethFactory = await ethers.getContractFactory("WETH9");
    return await wethFactory.deploy();
}
exports.createUniswap = async function(owner, weth) {
    const factory = await new ethers.ContractFactory(UniswapV2FactoryJson.abi, UniswapV2FactoryJson.bytecode, owner).deploy(owner.address);
    const router = await new ethers.ContractFactory(UniswapV2Router02Json.abi, UniswapV2Router02Json.bytecode, owner).deploy(factory.address, weth.address);
    const library = await new ethers.ContractFactory(UniswapV2LibraryJson.abi, UniswapV2LibraryJson.bytecode, owner).deploy();
    return {
        factory,
        router,
        library,
        pairFor: address => new ethers.Contract(address, UniswapV2PairJson.abi, owner)
    };
}