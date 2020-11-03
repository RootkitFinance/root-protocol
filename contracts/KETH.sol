// SPDX-License-Identifier: K-K-K-KORA!!
pragma solidity ^0.7.4;

import "./ERC20Backing.sol";
import "./IWETH.sol";
import "./SafeMath.sol";
import "./Kora.sol";

contract KETH is ERC20Backing
{
    using SafeMath for uint256;

    constructor (IWETH _weth, Kora _kora)
        ERC20Backing(_weth, _kora)
    {        
    }

    receive() external payable
    {
        if (msg.sender != address(wrappedToken)) {
            deposit();
        }
    }

    function deposit() public payable
    {
        uint256 amount = msg.value;
        IWETH(address(wrappedToken)).deposit{ value: amount }();
        _mint(msg.sender, amount);
        emit Deposit(msg.sender, amount); 
    }

    function withdraw(uint256 _amount) public
    {
        _burn(msg.sender, _amount);
        IWETH(address(wrappedToken)).withdraw(_amount);
        emit Withdrawal(msg.sender, _amount);
        (bool success,) = msg.sender.call{ value: _amount }("");
        require (success, "Transfer failed");
    }
}