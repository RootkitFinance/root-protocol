// SPDX-License-Identifier: J-J-J-JENGA!!!
pragma solidity ^0.7.4;

import "./ERC20.sol";
import "./Owned.sol";
import "./IUniswapV2Pair.sol";
import "./GatedERC20.sol";

abstract contract LiquidityLockedERC20 is GatedERC20
{
    mapping (IUniswapV2Pair => bool) public liquidityPairLocked;
    mapping (address => bool) public liquidityController;

    struct CallRecord
    {
        address origin;
        uint32 blockNumber;
        bool transferFrom;
    }

    CallRecord balanceAllowed;

    constructor(string memory _name, string memory _symbol)
        GatedERC20(_name, _symbol)
    {
    }

    function setLiquidityLock(IUniswapV2Pair _liquidityPair, bool _locked) public
    {
        require (liquidityController[msg.sender], "Liquidity controller only");
        require (_liquidityPair.token0() == address(this) || _liquidityPair.token1() == address(this), "Unrelated pair");
        liquidityPairLocked[_liquidityPair] = _locked;
    }

    function setLiquidityController(address _liquidityController, bool _canControl) public ownerOnly()
    {
        liquidityController[_liquidityController] = _canControl;
    }

    function balanceOf(address account) public override view returns (uint256) 
    {
        IUniswapV2Pair pair = IUniswapV2Pair(address(msg.sender));
        if (liquidityPairLocked[pair]) {
            CallRecord memory last = balanceAllowed;
            require (last.origin == tx.origin && last.blockNumber == block.number, "Liquidity is locked");
            if (last.transferFrom) {
                (uint256 reserve0, uint256 reserve1,) = pair.getReserves();
                IERC20 tok = IERC20(pair.token0());
                if (address(tok) == address(this)) {
                    require (IERC20(pair.token1()).balanceOf(address(pair)) < reserve1, "Liquidity is locked");
                }
                else {
                    require (tok.balanceOf(address(pair)) < reserve0, "Liquidity is locked");
                }
            }
        }
        return super.balanceOf(account);
    }

    function allowBalance(bool _transferFrom) private
    {
        CallRecord memory last = balanceAllowed;
        CallRecord memory allow = CallRecord({ 
            origin: tx.origin,
            blockNumber: uint32(block.number),
            transferFrom: _transferFrom
        });
        require (last.origin != allow.origin || last.blockNumber != allow.blockNumber || last.transferFrom != allow.transferFrom, "Liquidity is locked (Please try again next block)");
        balanceAllowed = allow;
    }

    function transfer(address recipient, uint256 amount) public virtual override returns (bool) 
    {        
        if (liquidityPairLocked[IUniswapV2Pair(address(msg.sender))]) {
            allowBalance(false);
        }
        else {
            balanceAllowed = CallRecord({ origin: address(0), blockNumber: 0, transferFrom: false });
        }
        return super.transfer(recipient, amount);
    }

    function transferFrom(address sender, address recipient, uint256 amount) public virtual override returns (bool) 
    {
        if (liquidityPairLocked[IUniswapV2Pair(recipient)]) {
            allowBalance(true);
        }
        else {
            balanceAllowed = CallRecord({ origin: address(0), blockNumber: 0, transferFrom: false });
        }
        return super.transferFrom(sender, recipient, amount);
    }
}