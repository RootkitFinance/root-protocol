// SPDX-License-Identifier: J-J-J-JENGA!!!
pragma solidity ^0.7.4;

import "../GatedERC20.sol";

contract GatedERC20Test is GatedERC20("Test", "TST") 
{ 
    constructor()
    {
        _mint(msg.sender, 100 ether);
    }
}