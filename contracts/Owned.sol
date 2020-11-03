// SPDX-License-Identifier: K-K-K-KORA!!
pragma solidity ^0.7.4;

contract Owned
{    
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    address public owner = msg.sender;
    address internal pendingOwner;

    modifier ownerOnly()
    {
        require (msg.sender == owner, "Owner only");
        _;
    }

    function transferOwnership(address newOwner) public ownerOnly()
    {
        pendingOwner = newOwner;
    }

    function claimOwnership() public
    {
        require (pendingOwner == msg.sender);
        pendingOwner = address(0);
        emit OwnershipTransferred(owner, msg.sender);
        owner = msg.sender;
    }
}