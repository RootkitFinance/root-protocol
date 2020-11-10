// SPDX-License-Identifier: J-J-J-JENGA!!!
pragma solidity ^0.7.4;

import "../IRootKitDistribution.sol";
import "../RootKit.sol";

contract RootKitDistributionTest is IRootKitDistribution
{
    RootKit immutable rootKit;
    mapping (address => uint256) public claimCallAmount;

    constructor(RootKit _rootKit)
    {
        rootKit = _rootKit;
    }

    function distribute() public override payable 
    { 
        rootKit.transferFrom(msg.sender, address(this), rootKit.totalSupply());
    }

    function claim(address _to, uint256 _amount) public override
    {
        claimCallAmount[_to] = _amount;
    }
}