// SPDX-License-Identifier: K-K-K-KORA!!
pragma solidity ^0.7.4;

import "../ERC20.sol";

contract ERC20Test is ERC20("Test", "TST") 
{ 
    constructor()
    {
        _mint(msg.sender, 100 ether);
    }
}