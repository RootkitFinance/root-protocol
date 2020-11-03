// SPDX-License-Identifier: K-K-K-KORA!!
pragma solidity ^0.7.4;

import "./IERC20.sol";
import "./IWrapper.sol";

interface IWETH is IERC20, IWrapper
{
    function deposit() external payable;
    function withdraw(uint256 _amount) external;
}
