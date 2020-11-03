// SPDX-License-Identifier: K-K-K-KORA!!
pragma solidity ^0.7.4;

import "./IFloorCalculator.sol";
import "./Kora.sol";
import "./SafeMath.sol";
import "./UniswapV2Library.sol";
import "./IUniswapV2Factory.sol";

contract KoraFloorCalculator is IFloorCalculator
{
    using SafeMath for uint256;

    Kora immutable kora;
    IUniswapV2Factory immutable uniswapV2Factory;

    constructor(Kora _kora, IUniswapV2Factory _uniswapV2Factory)
    {
        kora = _kora;
        uniswapV2Factory = _uniswapV2Factory;
    }

    function calculateSubFloor(IERC20 baseToken, IERC20 wrappedToken, IERC20 backingToken) public override view returns (uint256)
    {
        require (baseToken == kora, "Kora only");
        
        address pair = UniswapV2Library.pairFor(address(uniswapV2Factory), address(kora), address(backingToken));
        uint256 freeKora = kora.totalSupply().sub(kora.balanceOf(pair));
        uint256 sellAllProceeds = 0;
        if (freeKora > 0) {
            address[] memory path = new address[](2);
            path[0] = address(kora);
            path[1] = address(backingToken);
            uint256[] memory amountsOut = UniswapV2Library.getAmountsOut(address(uniswapV2Factory), freeKora, path);
            sellAllProceeds = amountsOut[1];
        }
        uint256 currentlyBacked = wrappedToken.balanceOf(address(backingToken));
        if (currentlyBacked <= sellAllProceeds) { return 0; }
        return currentlyBacked - sellAllProceeds;
    }
}