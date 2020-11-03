// SPDX-License-Identifier: K-K-K-KORA!!
pragma solidity ^0.7.4;

import "./GatedERC20.sol";

contract Kora is GatedERC20("Kora", "KORA")
{
    constructor()
    {
        _mint(msg.sender, 10000 ether);
    }
}