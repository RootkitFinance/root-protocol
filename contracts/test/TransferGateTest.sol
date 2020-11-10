// SPDX-License-Identifier: J-J-J-JENGA!!!
pragma solidity ^0.7.4;
pragma experimental ABIEncoderV2;

import "../ITransferGate.sol";

contract TransferGateTest is ITransferGate
{
    address sendAddr1;
    address sendAddr2;
    uint256 burnAmount;
    uint256 addr1Amount;
    uint256 addr2Amount;

    function setParams(uint256 _burnAmount, address _addr1, uint256 _addr1Amount, address _addr2, uint256 _addr2Amount) public
    {
        sendAddr1 = _addr1;
        sendAddr2 = _addr2;
        burnAmount = _burnAmount;
        addr1Amount = _addr1Amount;
        addr2Amount = _addr2Amount;
    }

    function handleTransfer(address, address, address, uint256) external override view
        returns (uint256 burn, TransferGateTarget[] memory targets)
    {
        burn = burnAmount;

        uint8 count = (addr1Amount > 0 ? 1 : 0) + (addr2Amount > 0 ? 1 : 0);
        targets = new TransferGateTarget[](count);

        if (addr1Amount > 0) {
            targets[--count].destination = sendAddr1;
            targets[count].amount = addr1Amount;
        }
        if (addr2Amount > 0) {
            targets[--count].destination = sendAddr2;
            targets[count].amount = addr2Amount;
        }
    }
}