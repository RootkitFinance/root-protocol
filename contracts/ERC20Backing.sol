// SPDX-License-Identifier: K-K-K-KORA!!
pragma solidity ^0.7.4;

import "./IERC20.sol";
import "./ERC20.sol";
import "./SafeMath.sol";
import "./SafeERC20.sol";
import "./Kora.sol";
import "./IWrapper.sol";
import "./Owned.sol";
import "./IFloorCalculator.sol";

contract ERC20Backing is ERC20, IWrapper, Owned
{
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 public immutable wrappedToken;
    Kora immutable kora;

    IFloorCalculator public floorCalculator;
    
    mapping (address => bool) public sweepers;

    constructor(IERC20 _wrappedToken, Kora _kora)
        ERC20(string(abi.encodePacked("KORA [", _wrappedToken.name(), "]")), string(abi.encodePacked("K:", _wrappedToken.symbol())))
    {
        require (_wrappedToken != _kora);
        if (_wrappedToken.decimals() != 18) {
            _setupDecimals(_wrappedToken.decimals());
        }

        wrappedToken = _wrappedToken;
        kora = _kora;
    }

    function depositTokens(uint256 _amount) public
    {
        uint256 myBalance = wrappedToken.balanceOf(address(this));
        wrappedToken.safeTransferFrom(msg.sender, address(this), _amount);
        require (wrappedToken.balanceOf(address(this)) == myBalance.add(_amount), "Transfer not exact");
        _mint(msg.sender, _amount);
        emit Deposit(msg.sender, _amount);
    }

    function withdrawTokens(uint256 _amount) public
    {
        _burn(msg.sender, _amount);
        uint256 myBalance = wrappedToken.balanceOf(address(this));
        wrappedToken.safeTransfer(msg.sender, _amount);
        require (wrappedToken.balanceOf(address(this)) == myBalance.sub(_amount), "Transfer not exact");
        emit Withdrawal(msg.sender, _amount);
    }

    function setFloorCalculator(IFloorCalculator _floorCalculator) public ownerOnly()
    {
        floorCalculator = _floorCalculator;
    }

    function setSweeper(address sweeper, bool allow) public ownerOnly()
    {
        sweepers[sweeper] = allow;
    }

    function sweepFloor(address to) public returns (uint256 amountSwept)
    {
        require (to != address(0));
        require (sweepers[msg.sender], "Sweepers only");
        amountSwept = floorCalculator.calculateSubFloor(kora, wrappedToken, this);
        if (amountSwept > 0) {
            wrappedToken.safeTransfer(to, amountSwept);
        }
    }
}