// SPDX-License-Identifier: K-K-K-KORA!!
pragma solidity ^0.7.4;
pragma experimental ABIEncoderV2;

struct TransferTarget
{
    address destination;
    uint256 amount;
}

interface ITransferGate
{
    function handleTransfer(address msgSender, address from, address to, uint256 amount) external
        returns (uint256 burn, TransferTarget[] memory targets);
}