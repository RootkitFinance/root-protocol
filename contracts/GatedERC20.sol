// SPDX-License-Identifier: K-K-K-KORA!!
pragma solidity ^0.7.4;
pragma experimental ABIEncoderV2;

import "./ERC20.sol";
import "./ITransferGate.sol";
import "./Owned.sol";
import "./SafeMath.sol";

abstract contract GatedERC20 is ERC20, Owned
{
    using SafeMath for uint256;

    ITransferGate public transferGate;

    constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol)
    {
    }

    function setTransferGate(ITransferGate _transferGate) public ownerOnly()
    {
        transferGate = _transferGate;
    }

    function _transfer(address sender, address recipient, uint256 amount) internal virtual override 
    {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");

        _beforeTokenTransfer(sender, recipient, amount);

        ITransferGate _transferGate = transferGate;
        uint256 remaining = amount;
        if (address(_transferGate) != address(0)) {
            (uint256 burn, TransferTarget[] memory targets) = _transferGate.handleTransfer(msg.sender, sender, recipient, amount);            
            if (burn > 0) {
                amount = remaining = remaining.sub(burn, "Burn too much");
                _burn(sender, burn);
            }
            for (uint256 x = 0; x < targets.length; ++x) {
                (address dest, uint256 amt) = (targets[x].destination, targets[x].amount);
                remaining = remaining.sub(amt, "Transfer too much");
                balanceOf[dest] = balanceOf[dest].add(amt);
            }
        }
        balanceOf[sender] = balanceOf[sender].sub(amount, "ERC20: transfer amount exceeds balance");
        balanceOf[recipient] = balanceOf[recipient].add(remaining);
        emit Transfer(sender, recipient, amount);
    }
}