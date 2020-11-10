// SPDX-License-Identifier: J-J-J-JENGA!!!
pragma solidity ^0.7.4;

/* ROOTKIT:
A wrapped token, where the underlying token can be swept
and used for other purposes
Governed by an installable floor calculator contract
Sweepable by designated sweeper addresses
*/

import "./IERC20.sol";
import "./SafeERC20.sol";
import "./Owned.sol";
import "./IFloorCalculator.sol";
import "./WrappedERC20.sol";
import "./IERC31337.sol";

contract ERC31337 is Owned, WrappedERC20, IERC31337
{
    using SafeERC20 for IERC20;

    IFloorCalculator public override floorCalculator;
    
    mapping (address => bool) public override sweepers;

    constructor(IERC20 _wrappedToken)
        WrappedERC20(_wrappedToken, string(abi.encodePacked("RootKit [", _wrappedToken.name(), "]")), string(abi.encodePacked("RK:", _wrappedToken.symbol())))
    {
    }

    function setFloorCalculator(IFloorCalculator _floorCalculator) public override ownerOnly()
    {
        floorCalculator = _floorCalculator;
    }

    function setSweeper(address sweeper, bool allow) public override ownerOnly()
    {
        sweepers[sweeper] = allow;
    }

    function sweepFloor(address to) public override returns (uint256 amountSwept)
    {
        require (to != address(0));
        require (sweepers[msg.sender], "Sweepers only");
        amountSwept = floorCalculator.calculateSubFloor(wrappedToken, this);
        if (amountSwept > 0) {
            wrappedToken.safeTransfer(to, amountSwept);
        }
    }
}