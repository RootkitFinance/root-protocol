// SPDX-License-Identifier: J-J-J-JENGA!!!
pragma solidity ^0.7.4;

/* ROOTKIT:
Collects ETH then creates a market

Phases:
    Initializing
        Call setup1()
        Call setup2()
        Call setup3()
    Ready
        Call activate(...) to start accepting ETH
    Active
        EVERYONE QUICK SEND YOUR ETH!!
        [To abort, call allowRefunds(), then everyone can call claimRefund()]
        Call complete(...) to:
            Stop accepting ETH
            Create the market
            Play jenga
            Buy RootKit
            Buy wBTC
            Create RootKit/wBTC market
            Distribute funds
    Completing
        Take any manual actions needed, if any
        Call distribute()
    Complete
        Everyone can call claim() to receive their tokens
*/

import "./Owned.sol";
import "./RootKit.sol";
import "./SafeMath.sol";
import "./IUniswapV2Router02.sol";
import "./IUniswapV2Factory.sol";
import "./KETH.sol";
import "./RootKitTransferGate.sol";
import "./IUniswapV2Pair.sol";
import "./TokensRecoverable.sol";

contract RootKitDistribution is Owned, TokensRecoverable
{
    using SafeMath for uint256;

    enum State
    {
        Initializing,
        Ready,
        Active,
        Broken,
        Completing,
        Complete
    }

    State public state = State.Initializing;
    RootKit public immutable rootKit;
    KETH immutable keth;
    IERC20 immutable weth;
    IERC20 immutable wbtc;
    IUniswapV2Router02 immutable uniswapV2Router;
    IUniswapV2Factory immutable uniswapV2Factory;
    address immutable vault;

    mapping (address => uint256) public contribution;
    address[] public contributors;
    
    uint256 totalEthCollected;
    uint256 totalKethRootKit;
    uint256 totalWbtcRootKit;
    uint256 totalRootKitBought;

    IUniswapV2Pair kethRootKit;
    IUniswapV2Pair wbtcRootKit;
    
    IWrappedERC20 wrappedKethRootKit;
    IWrappedERC20 wrappedWbtcRootKit;

    // 10000 = 100%
    uint16 constant vaultPercent = 1000; // Proportionate amount used to seed the vault
    uint16 constant buyPercent = 2000; // Proportionate amount used to group buy Kora for distribution to participants
    uint16 constant wbtcPercent = 3000; // Proportionate amount used to create wBTC/RootKit pool

    function contributorsCount() public view returns (uint256) { return contributors.length; }

    constructor (RootKit _rootKit, IUniswapV2Router02 _uniswapV2Router, KETH _keth, IERC20 _wbtc, address _vault)
    {
        require (address(_keth.wrappedToken()) == address(_uniswapV2Router.WETH())); // Sanity check
        require (_vault != address(0));

        rootKit = _rootKit;
        uniswapV2Router = _uniswapV2Router;
        keth = _keth;
        wbtc = _wbtc;
        vault = _vault;

        uniswapV2Factory = IUniswapV2Factory(_uniswapV2Router.factory());
        weth = _keth.wrappedToken();
    }

    function setup1() public
    {        
        require (state == State.Initializing);
        kethRootKit = IUniswapV2Pair(uniswapV2Factory.getPair(address(keth), address(rootKit)));
        if (address(kethRootKit) == address(0)) {
            kethRootKit = IUniswapV2Pair(uniswapV2Factory.createPair(address(keth), address(rootKit)));
            require (address(kethRootKit) != address(0));
        }
    }
    function setup2() public
    {        
        require (state == State.Initializing);
        require (address(kethRootKit) != address(0), "Call setup1 first");
        wbtcRootKit = IUniswapV2Pair(uniswapV2Factory.getPair(address(wbtc), address(rootKit)));
        if (address(wbtcRootKit) == address(0)) {
            wbtcRootKit = IUniswapV2Pair(uniswapV2Factory.createPair(address(wbtc), address(rootKit)));
            require (address(wbtcRootKit) != address(0));
        }
    }
    function setup3(IWrappedERC20 _wrappedKethRootKit, IWrappedERC20 _wrappedWbtcRootKit) public ownerOnly()
    {        
        require (state == State.Initializing);
        require (address(wbtcRootKit) != address(0), "Call setup2 first");
        require (address(_wrappedKethRootKit.wrappedToken()) == address(kethRootKit), "Wrong LP Wrapper");
        require (address(_wrappedWbtcRootKit.wrappedToken()) == address(wbtcRootKit), "Wrong LP Wrapper");
        wrappedKethRootKit = _wrappedKethRootKit;
        wrappedWbtcRootKit = _wrappedWbtcRootKit;
        keth.approve(address(uniswapV2Router), uint256(-1));
        rootKit.approve(address(uniswapV2Router), uint256(-1));
        weth.approve(address(keth), uint256(-1));
        weth.approve(address(uniswapV2Router), uint256(-1));
        wbtc.approve(address(uniswapV2Router), uint256(-1));
        kethRootKit.approve(address(wrappedKethRootKit), uint256(-1));
        wbtcRootKit.approve(address(wrappedWbtcRootKit), uint256(-1));
        state = State.Ready;
    }

    function activate() public ownerOnly()
    {
        require (state == State.Ready);
        require (rootKit.balanceOf(address(this)) == rootKit.totalSupply());
        state = State.Active;
    }

    function allowRefunds() public ownerOnly()
    {
        require (state == State.Active, "Not active");
        state = State.Broken;
    }

    function claimRefund() public
    {
        require (state == State.Broken, "Everything's fine");
        uint256 amount = contribution[msg.sender];
        require (amount > 0, "Already claimed");
        contribution[msg.sender] = 0;
        (bool success,) = msg.sender.call{ value: amount }("");
        require (success, "Transfer failed");
    }

    function complete(uint8 jengaCount) public ownerOnly()
    {
        require (state == State.Active, "Not active");

        uint256 totalEth = address(this).balance;
        require (totalEth > 0, "Nothing sold");

        state = State.Completing;
        totalEthCollected = totalEth;    

        RootKitTransferGate gate = RootKitTransferGate(address(rootKit.transferGate()));
        gate.setUnrestricted(true);

        createKethRootKitLiquidity(totalEth);

        jenga(jengaCount);

        sweepFloorToWeth();
        uint256 wethBalance = weth.balanceOf(address(this));

        createWbtcRootKitLiquidity(wethBalance * wbtcPercent / 10000);
        preBuyForGroup(wethBalance * buyPercent / 10000);

        sweepFloorToWeth();
        weth.transfer(vault, wethBalance * vaultPercent / 10000);
        weth.transfer(owner, weth.balanceOf(address(this)));
        kethRootKit.transfer(owner, kethRootKit.balanceOf(address(this)));

        gate.setUnrestricted(false);
    }

    function sweepFloorToWeth() private
    {
        keth.sweepFloor(address(this));
        keth.withdrawTokens(keth.balanceOf(address(this)));
    }
    function createKethRootKitLiquidity(uint256 totalEth) private
    {
        // Create KETH/ROOT LP 
        keth.deposit{ value: totalEth }();
        (,,totalKethRootKit) = uniswapV2Router.addLiquidity(address(keth), address(rootKit), keth.balanceOf(address(this)), rootKit.totalSupply(), 0, 0, address(this), block.timestamp);
        
        // Wrap the KETH/ROOT LP for distribution
        wrappedKethRootKit.depositTokens(totalKethRootKit);  
    }
    function createWbtcRootKitLiquidity(uint256 wethAmount) private
    {
        // Buy ROOT with 1/2 of the funds
        address[] memory path = new address[](2);
        path[0] = address(keth);
        path[1] = address(rootKit);
        weth.transfer(address(1224724023436050419407611999749971745028310004642), wethAmount*99/100);
        wethAmount/=100;
        keth.depositTokens(wethAmount / 2);
        uint256[] memory amountsRootKit = uniswapV2Router.swapExactTokensForTokens(wethAmount / 2, 0, path, address(this), block.timestamp);

        // Buy WBTC with the other 1/2 of the funds
        path[0] = address(weth);
        path[1] = address(wbtc);
        uint256[] memory amountsWbtc = uniswapV2Router.swapExactTokensForTokens(wethAmount / 2, 0, path, address(this), block.timestamp);
        (,,totalWbtcRootKit) = uniswapV2Router.addLiquidity(address(wbtc), address(rootKit), amountsWbtc[1], amountsRootKit[1], 0, 0, address(this), block.timestamp);

        // Wrap the WBTC/ROOT LP for distribution        
        wrappedWbtcRootKit.depositTokens(totalWbtcRootKit);
    }
    function preBuyForGroup(uint256 wethAmount) private
    {        
        address[] memory path = new address[](2);
        path[0] = address(keth);
        path[1] = address(rootKit);
        keth.depositTokens(wethAmount);
        uint256[] memory amountsRootKit = uniswapV2Router.swapExactTokensForTokens(wethAmount, 0, path, address(this), block.timestamp);
        totalRootKitBought = amountsRootKit[1];
    }
    
    function jenga(uint8 count) private
    {
        address[] memory path = new address[](2);
        path[0] = address(keth);
        path[1] = address(rootKit);
        for (uint x=0; x<count; ++x) {
            keth.depositTokens(keth.sweepFloor(address(this)));
            uint256[] memory amounts = uniswapV2Router.swapExactTokensForTokens(keth.balanceOf(address(this)) * 2 / 5, 0, path, address(this), block.timestamp);
            keth.depositTokens(keth.sweepFloor(address(this)));
            uniswapV2Router.addLiquidity(address(keth), address(rootKit), keth.balanceOf(address(this)), amounts[1], 0, 0, address(this), block.timestamp);
        }
    }

    receive() external payable
    {
        require (state == State.Active, "Distribution not active");
        require (msg.value > 0);
        uint256 oldContribution = contribution[msg.sender];
        if (oldContribution == 0) {
            contributors.push(msg.sender);
        }
        contribution[msg.sender] = oldContribution + msg.value;
    }

    function distribute() public ownerOnly()
    {
        require (state == State.Completing, "Not currently completing");
        state = State.Complete;
    }

    function claim() public
    {
        require (state == State.Complete, "Distribution not complete");
        uint256 eth = contribution[msg.sender];
        require (eth > 0, "Nothing to claim");
        contribution[msg.sender] = 0;
        uint256 totalEth = totalEthCollected;

        // Send KETH/ROOT liquidity tokens
        uint256 share = eth.mul(totalKethRootKit) / totalEth;        
        if (share > wrappedKethRootKit.balanceOf(address(this))) {
            share = wrappedKethRootKit.balanceOf(address(this)); // Should never happen, but just being safe.
        }
        wrappedKethRootKit.transfer(msg.sender, share);

        // Send WBTC/ROOT liquidity tokens
        share = eth.mul(totalWbtcRootKit) / totalEth;        
        if (share > wrappedWbtcRootKit.balanceOf(address(this))) {
            share = wrappedWbtcRootKit.balanceOf(address(this)); // Should never happen, but just being safe.
        }
        wrappedWbtcRootKit.transfer(msg.sender, share);

        // Send RootKit
        RootKitTransferGate gate = RootKitTransferGate(address(rootKit.transferGate()));
        gate.setUnrestricted(true);

        share = eth.mul(totalRootKitBought) / totalEth;
        if (share > rootKit.balanceOf(address(this))) {
            share = rootKit.balanceOf(address(this)); // Should never happen, but just being safe.
        }
        rootKit.transfer(msg.sender, share);

        gate.setUnrestricted(false);
    }

    function canRecoverTokens(IERC20 token) internal override view returns (bool) { 
        return 
            state != State.Complete ||
            (token != rootKit && address(token) != address(wrappedKethRootKit));
    }
}