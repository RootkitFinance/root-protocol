// SPDX-License-Identifier: J-J-J-JENGA!!!
pragma solidity ^0.7.4;

import "./Owned.sol";

contract BlackListRegistry is Owned
{
    mapping (address => bool) public blackList;
    
    function setBlackListed(address account, bool blackListed) public ownerOnly()
    {
        blackList[account] = blackListed;
    }
}