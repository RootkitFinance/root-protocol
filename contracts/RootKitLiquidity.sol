// SPDX-License-Identifier: J-J-J-JENGA!!!
pragma solidity ^0.7.4;

/* ROOTKIT:
A wrapper for liquidity tokens so they can be distributed
but not allowing for removal of liquidity
*/

import "./ERC31337.sol";
import "./IUniswapV2Pair.sol";
import "./IERC20.sol";

contract RootKitLiquidity is ERC31337
{
    constructor(IUniswapV2Pair _pair)
        ERC31337(
            IERC20(address(_pair)), 
            string(abi.encodePacked("RootKit [Uniswap ", IERC20(_pair.token0()).name(), " / ", IERC20(_pair.token1()).name(), "]")), 
            string(abi.encodePacked("RK:", IERC20(_pair.token0()).symbol(), "-", IERC20(_pair.token1()).symbol())))
    {
    }

    function _beforeWithdrawTokens(uint256) internal override pure
    { 
        revert("RootKit liquidity is locked");
    }
}