// SPDX-License-Identifier: J-J-J-JENGA!!!
pragma solidity ^0.7.4;

import "../LiquidityLockedERC20.sol";

contract LiquidityLockedERC20Test is LiquidityLockedERC20("test", "TEST")
{   
    constructor()
    {
        _mint(msg.sender, 100 ether);
    } 
}