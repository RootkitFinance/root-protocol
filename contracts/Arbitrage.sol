// SPDX-License-Identifier: J-J-J-JENGA!!!
pragma solidity ^0.7.4;

import "./IERC20.sol";
import "./IERC31337.sol";
import "./TokensRecoverable.sol";
import "./IUniswapV2Router02.sol";

contract Arbitrage is TokensRecoverable
{
    IERC20 public immutable baseToken;
    IERC31337 public immutable eliteToken;
    IERC20 public immutable rootedToken;
    IUniswapV2Router02 public immutable uniswapRouter;

    mapping (address => bool) public arbitrageurs;

    event Profit(uint256 _value);

    constructor(IERC20 _baseToken, IERC31337 _eliteToken, IERC20 _rootedToken, IUniswapV2Router02 _uniswapRouter)
    {
        baseToken = _baseToken;
        eliteToken = _eliteToken;
        rootedToken = _rootedToken;
        uniswapRouter = _uniswapRouter;
       
        _baseToken.approve(address(_uniswapRouter), uint256(-1));
        _eliteToken.approve(address(_uniswapRouter), uint256(-1));
        _rootedToken.approve(address(_uniswapRouter), uint256(-1));
        _baseToken.approve(address(_eliteToken), uint256(-1));
    }    

    modifier arbitrageurOnly()
    {
        require(arbitrageurs[msg.sender], "Not an arbitrageur");
        _;
    }

    function setArbitrageur(address arbitrageur, bool allow) public ownerOnly()
    {
        arbitrageurs[arbitrageur] = allow;
    }

    function balancePriceBase(uint256 baseAmount, uint256 minAmountOut) public arbitrageurOnly() 
    {
        address[] memory path = new address[](2);
        path[0] = address(baseToken);
        path[1] = address(rootedToken);
        path[2] = address(eliteToken);

        uint256[] memory amounts = uniswapRouter.swapExactTokensForTokens(baseAmount, minAmountOut, path, address(this), block.timestamp);
        uint256 eliteAmount = amounts[2];
        require(eliteAmount > baseAmount, "No profit");

        eliteToken.withdrawTokens(eliteAmount);
        emit Profit(eliteAmount - baseAmount);
    }

    function balancePriceElite(uint256 eliteAmount, uint256 minAmountOut) public arbitrageurOnly() 
    {
        eliteToken.depositTokens(eliteAmount);

        address[] memory path = new address[](2);
        path[0] = address(eliteToken);
        path[1] = address(rootedToken);
        path[2] = address(baseToken);

        uint256[] memory amounts = uniswapRouter.swapExactTokensForTokens(eliteAmount, minAmountOut, path, address(this), block.timestamp);
        uint256 baseAmount = amounts[2];
        require(baseAmount > eliteAmount, "No profit");

        emit Profit(baseAmount - eliteAmount);
    }
}
