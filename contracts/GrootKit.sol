// SPDX-License-Identifier: J-J-J-JENGA!!!
pragma solidity ^0.7.4;

import "./LiquidityLockedERC20.sol";

/* GROOTKIT:
Direct from Professor Ponzo's lab
*/

contract GrootKit is LiquidityLockedERC20("GrootKit", "GROOT")
{
    constructor()
    {
        _mint(msg.sender, 1000000 ether);
    }
}