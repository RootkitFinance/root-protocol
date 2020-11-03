// SPDX-License-Identifier: K-K-K-KORA!!
pragma solidity ^0.7.4;

interface IWrapper
{    
    event Deposit(address indexed from, uint256 amount);
    event Withdrawal(address indexed to, uint256 amount);
}