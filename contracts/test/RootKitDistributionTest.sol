// SPDX-License-Identifier: J-J-J-JENGA!!!
pragma solidity ^0.7.4;

import "../IRootKitDistribution.sol";
import "../RootKit.sol";

contract RootKitDistributionTest is IRootKitDistribution
{
    RootKit immutable rootKit;
    mapping (address => uint256) public claimCallAmount;
    bool public override distributionComplete;

    constructor(RootKit _rootKit)
    {
        rootKit = _rootKit;
    }

    function distribute() public override payable 
    { 
        require (!distributionComplete, "Already complete");
        rootKit.transferFrom(msg.sender, address(this), rootKit.totalSupply());
        distributionComplete = true;
    }

    function claim(address _to, uint256 _amount) public override
    {
        require (distributionComplete, "Not complete");
        claimCallAmount[_to] = _amount;
    }
}