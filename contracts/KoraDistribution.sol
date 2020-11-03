// SPDX-License-Identifier: K-K-K-KORA!!
pragma solidity ^0.7.4;

import "./Owned.sol";
import "./Kora.sol";
import "./SafeMath.sol";
import "./IUniswapV2Router02.sol";
import "./IUniswapV2Factory.sol";
import "./KETH.sol";
import "./KoraTransferGate.sol";
import "./IUniswapV2Pair.sol";

contract KoraDistribution is Owned
{
    using SafeMath for uint256;

    bool public isActive;
    Kora public immutable kora;
    KETH immutable keth;
    IUniswapV2Router02 immutable uniswapV2Router;
    IUniswapV2Factory immutable uniswapV2Factory;        

    bool isBroken;

    mapping (address => uint256) public contribution;
    address[] public contributors;
    uint256 public contributorDistributionIndex;
    
    uint256 totalEthCollected;
    uint256 totalLiquidity;
    IUniswapV2Pair kethKora;

    function contributorsCount() public view returns (uint256) { return contributors.length; }

    constructor (Kora _kora, IUniswapV2Router02 _uniswapV2Router, KETH _keth)
    {
        require (address(_keth.wrappedToken()) == address(_uniswapV2Router.WETH())); // Sanity check

        kora = _kora;
        uniswapV2Router = _uniswapV2Router;
        keth = _keth;

        uniswapV2Factory = IUniswapV2Factory(_uniswapV2Router.factory());
    }

    function activate() public ownerOnly()
    {
        require (contributors.length == 0);
        require (kora.balanceOf(address(this)) == kora.totalSupply());
        isActive = true;
        kethKora = IUniswapV2Pair(uniswapV2Factory.getPair(address(keth), address(kora)));
        if (address(kethKora) == address(0)) {
            kethKora = IUniswapV2Pair(uniswapV2Factory.createPair(address(keth), address(kora)));
        }
        keth.approve(address(uniswapV2Router), uint256(-1));
        kora.approve(address(uniswapV2Router), uint256(-1));
        keth.wrappedToken().approve(address(keth), uint256(-1));
    }

    function allowRefunds() public ownerOnly()
    {
        require (!isBroken && isActive);
        isActive = false;
        isBroken = true;
    }

    function claimRefund() public
    {
        require (isBroken, "Everything's fine");
        uint256 amount = contribution[msg.sender];
        require (amount > 0, "Already claimed");
        contribution[msg.sender] = 0;
        (bool success,) = msg.sender.call{ value: amount }("");
        require (success, "Transfer failed");
    }

    function deactivate() public ownerOnly()
    {
        require (isActive);        
        isActive = false;

        uint256 totalEth = address(this).balance;

        if (totalEth == 0) { return; }
        
        totalEthCollected = totalEth;
        
        keth.deposit{ value: totalEth }();

        jenga();

        totalLiquidity = kethKora.balanceOf(address(this));
    }

    function jenga() private
    {
        KoraTransferGate gate = KoraTransferGate(address(kora.transferGate()));
        gate.setUnrestricted(true);

        uint256 totalKeth = keth.balanceOf(address(this));
        uint256 totalKora = kora.totalSupply();
        
        console.log("Adding initial liquidity with %s KETH and %s KORA", totalKeth, totalKora);
        (uint256 kethUsed, uint256 koraUsed, uint256 liquidity) = uniswapV2Router.addLiquidity(address(keth), address(kora), totalKeth, totalKora, 0, 0, address(this), block.timestamp);
        console.log("Initial KETH = %s, KORA = %s, Liquidity = %s", kethUsed, koraUsed, liquidity);

        // address[] memory path = new address[](2);
        // path[0] = address(keth);
        // path[1] = address(kora);
        // for (uint x=0; x<5; ++x) {
        //     uint256 swept = keth.sweepFloor(address(this));
        //     keth.depositTokens(swept);
        //     if (swept < 0.001 ether) { break; }
        //     (uint256[] memory amounts) = uniswapV2Router.swapExactTokensForTokens(swept, 0, path, address(this), block.timestamp);
        //     console.log("Iteration %s: Swept %s KETH and bought %s KORA with it", x+1, swept, amounts[1]);
            
        //     swept = keth.sweepFloor(address(this));
        //     keth.depositTokens(swept);
        //     console.log("Swept %s more KETH", swept);

        //     console.log("My balances are KETH = %s, KORA = %s", keth.balanceOf(address(this)), kora.balanceOf(address(this)));

        //     (kethUsed, koraUsed, liquidity) = uniswapV2Router.addLiquidity(address(keth), address(kora), swept, amounts[1], 0, 0, address(this), block.timestamp);
        //     console.log("Added liquidity and used KETH = %s, KORA = %s, Liquidity = %s", kethUsed, koraUsed, liquidity);
        // }
        // console.log("My final balances are KETH = %s, KORA = %s", keth.balanceOf(address(this)), kora.balanceOf(address(this)));

        gate.setUnrestricted(false);
    }

    receive() external payable
    {
        require (isActive, "Distribution not active");
        require (msg.value > 0);
        uint256 oldContribution = contribution[msg.sender];
        if (oldContribution == 0) {
            contributors.push(msg.sender);
        }
        contribution[msg.sender] = oldContribution + msg.value;
    }

    function isComplete() public view returns (bool)
    {
        return contributorDistributionIndex == contributors.length && !isActive && !isBroken && contributors.length > 0;
    }

    function distribute(uint256 _iterations) public
    {
        uint256 count = contributors.length;
        uint256 index = contributorDistributionIndex;
        require (_iterations > 0 && !isActive && !isBroken && count > 0, "Nothing to distribute");
        require (index < count, "Distribution complete");
        uint256 totalEth = totalEthCollected;
        uint256 totalLiq = totalLiquidity;
        uint256 liqBalance = kethKora.balanceOf(address(this));
        
        while (_iterations-- > 0 && index < count) {
            address recipient = contributors[index++];
            uint256 share = contribution[recipient].mul(totalLiq) / totalEth;
            if (share > liqBalance) { 
                share = liqBalance; // Should never happen, but just being safe.
            }
            liqBalance -= share;
            kethKora.transfer(recipient, share);
        }
        contributorDistributionIndex = index;
   }
}