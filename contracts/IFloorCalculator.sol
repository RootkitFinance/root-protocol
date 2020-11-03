// SPDX-License-Identifier: K-K-K-KORA!!
pragma solidity ^0.7.4;

import "./IUniswapV2Pair.sol";
import "./IERC20.sol";

interface IFloorCalculator
{
    function calculateSubFloor(IERC20 baseToken, IERC20 wrappedToken, IERC20 backingToken) external view returns (uint256);
}