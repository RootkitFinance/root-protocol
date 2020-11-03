// SPDX-License-Identifier: K-K-K-KORA!!
pragma solidity ^0.7.4;
pragma experimental ABIEncoderV2;

import "hardhat/console.sol";

import "./ITransferGate.sol";
import "./Owned.sol";
import "./IUniswapV2Factory.sol";
import "./IERC20.sol";
import "./IUniswapV2Pair.sol";
import "./Kora.sol";
import "./Address.sol";
import "./IUniswapV2Router02.sol";
import "./SafeERC20.sol";
import "./SafeMath.sol";

struct KoraTransferGateParameters
{
    address dev;
    uint16 poolRate; // 10000 = 100%
    uint16 burnRate; // 10000 = 100%
    uint16 devRate;  // 10000 = 100%
}

contract KoraTransferGate is Owned
{   
    using Address for address;
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    KoraTransferGateParameters public parameters;
    IUniswapV2Router02 immutable uniswapV2Router;
    IUniswapV2Factory immutable uniswapV2Factory;
    Kora immutable kora;

    enum AddressState
    {
        Unknown,
        NotPool,
        DisallowedPool,
        AllowedPool
    }

    mapping (address => AddressState) addressStates;
    IERC20[] public allowedPoolTokens;
    
    bool public unrestricted;
    mapping (address => bool) public unrestrictedControllers;
    mapping (address => bool) public freeParticipant;

    mapping (address => uint256) liquiditySupply;
    address mustUpdate;    

    constructor(Kora _kora, IUniswapV2Router02 _uniswapV2Router)
    {
        kora = _kora;
        uniswapV2Router = _uniswapV2Router;
        uniswapV2Factory = IUniswapV2Factory(_uniswapV2Router.factory());
    }

    function allowedPoolTokensCount() public view returns (uint256) { return allowedPoolTokens.length; }

    function setUnrestrictedController(address unrestrictedController, bool allow) public ownerOnly()
    {
        unrestrictedControllers[unrestrictedController] = allow;
    }

    function setFreeParticipant(address participant, bool free) public ownerOnly()
    {
        freeParticipant[participant] = free;
    }

    function setUnrestricted(bool _unrestricted) public {
        require (unrestrictedControllers[msg.sender]);
        unrestricted = _unrestricted;
    }

    function setParameters(address _dev, uint16 _poolRate, uint16 _burnRate, uint16 _devRate) public ownerOnly()
    {
        require (_poolRate <= 10000 && _burnRate <= 10000 && _devRate <= 10000 && _poolRate + _burnRate + _devRate <= 10000, "> 100%");
        
        KoraTransferGateParameters memory _parameters;
        _parameters.dev = _dev;
        _parameters.poolRate = _poolRate;
        _parameters.burnRate = _burnRate;
        _parameters.devRate = _devRate;
        parameters = _parameters;
    }

    function allowPool(IERC20 token) public ownerOnly()
    {
        address pool = uniswapV2Factory.getPair(address(kora), address(token));
        if (pool == address(0)) {
            pool = uniswapV2Factory.createPair(address(kora), address(token));
        }
        AddressState state = addressStates[pool];
        require (state != AddressState.AllowedPool, "Already allowed");
        addressStates[pool] = AddressState.AllowedPool;
        allowedPoolTokens.push(token);
    }

    function safeAddLiquidity(IERC20 token, uint256 tokenAmount, uint256 koraAmount, uint256 minTokenAmount, uint256 minKoraAmount, address to, uint256 deadline) public
        returns (uint256 koraUsed, uint256 tokenUsed, uint256 liquidity)
    {
        address pool = uniswapV2Factory.getPair(address(kora), address(token));
        require (pool != address(0) && addressStates[pool] == AddressState.AllowedPool, "Pool not approved");
        unrestricted = true;

        uint256 tokenBalance = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), tokenAmount);
        kora.transferFrom(msg.sender, address(this), koraAmount);
        kora.approve(address(uniswapV2Router), koraAmount);
        token.safeApprove(address(uniswapV2Router), tokenAmount);
        (koraUsed, tokenUsed, liquidity) = uniswapV2Router.addLiquidity(address(kora), address(token), koraAmount, tokenAmount, minKoraAmount, minTokenAmount, to, deadline);
        liquiditySupply[pool] = IERC20(pool).totalSupply();
        if (mustUpdate == pool) {
            mustUpdate = address(0);
        }

        if (koraUsed < koraAmount) {
            kora.transfer(msg.sender, koraAmount - koraUsed);
        }
        tokenBalance = token.balanceOf(address(this)).sub(tokenBalance); // we do it this way in case there's a burn
        if (tokenBalance > 0) {
            token.safeTransfer(msg.sender, tokenBalance);
        }
        
        unrestricted = false;
    }

    function handleTransfer(address, address from, address to, uint256 amount) external
        returns (uint256 burn, TransferTarget[] memory targets)
    {
        address mustUpdateAddress = mustUpdate;
        if (mustUpdateAddress != address(0)) {
            mustUpdate = address(0);
            console.log("Updating totalSupply for %s from last call: %s -> %s", mustUpdateAddress, liquiditySupply[mustUpdateAddress], IERC20(mustUpdateAddress).totalSupply());
            liquiditySupply[mustUpdateAddress] = IERC20(mustUpdateAddress).totalSupply();
        }
        AddressState fromState = addressStates[from];
        AddressState toState = addressStates[to];
        if (fromState != AddressState.AllowedPool && toState != AddressState.AllowedPool) {
            if (fromState == AddressState.Unknown) { fromState = detectState(from); }
            if (toState == AddressState.Unknown) { toState = detectState(to); }
            require (unrestricted || (fromState != AddressState.DisallowedPool && toState != AddressState.DisallowedPool), "Pool not approved");
        }
        if (toState == AddressState.AllowedPool) {
            mustUpdate = to;
            console.log("Will update totalSupply for %s on next call", to);
        }
        if (fromState == AddressState.AllowedPool) {
            console.log("[from %s] Supply %s -> %s", from, liquiditySupply[from], IERC20(from).totalSupply());
            if (unrestricted) {
                liquiditySupply[from] = IERC20(from).totalSupply();
            }
            require (IERC20(from).totalSupply() >= liquiditySupply[from], "Cannot remove liquidity");            
        }
        if (unrestricted || freeParticipant[from] || freeParticipant[to]) {
            console.log("Unrestricted transfer from %s to %s", from, to);
            return (0, new TransferTarget[](0));
        }
        console.log("Transferring from %s to %s: %s", from, to, amount);
        KoraTransferGateParameters memory params = parameters;        
        // "amount" will never be > totalSupply which is capped at 10k, so these multiplications will never overflow
        burn = amount * params.burnRate / 10000;
        console.log("Burning %s", burn);
        targets = new TransferTarget[]((params.devRate > 0 ? 1 : 0) + (params.poolRate > 0 ? 1 : 0));
        uint256 index = 0;
        if (params.poolRate > 0) {
            targets[index].destination = address(this);
            targets[index++].amount = amount * params.poolRate / 10000;
            console.log("Pool gets %s", targets[index-1].amount);
        }
        if (params.devRate > 0) {
            targets[index].destination = params.dev;
            targets[index].amount = amount * params.devRate / 10000;
            console.log("Dev gets %s", targets[index].amount);
        }
    }

    function detectState(address a) internal returns (AddressState state) 
    {
        state = AddressState.NotPool;
        if (a.isContract()) {
            try this.throwAddressState(a)
            {
                assert(false);
            }
            catch Error(string memory result) {
                if (bytes(result).length == 1) {
                    state = AddressState.NotPool;
                }
                else if (bytes(result).length == 2) {
                    state = AddressState.DisallowedPool;
                }
            }
            catch {
                console.log("Address %s threw unknown exeception", a);
            }
        }
        console.log("Address %s detected as type %s", a, uint256(state));
        addressStates[a] = state;
        return state;
    }
    
    // Not intended for external consumption.  Always throws.
    // We want to call functions to probe for things, but don't want to open ourselves up to
    // possible state-changes.  So we return a value by reverting with a message.
    function throwAddressState(address a) external view
    {
        try IUniswapV2Pair(a).factory() returns (address factory)
        {
            console.log("Address %s detected factory() = %s", a, factory);
            // don't care if it's some crappy alt-amm
            if (factory == address(uniswapV2Factory)) {
                console.log("Address %s detected factory() [matched uniswap]", a);
                // these checks for token0/token1 are just for additional
                // certainty that we're interacting with a uniswap pair
                try IUniswapV2Pair(a).token0() returns (address token0)
                {
                    if (token0 == address(kora)) {
                        console.log("Address %s detected token0() == kora - DisallowedPool", a);
                        revert("22");
                    }
                    try IUniswapV2Pair(a).token1() returns (address token1)
                    {
                        if (token1 == address(kora)) {
                            console.log("Address %s detected token1() == kora - DisallowedPool", a);
                            revert("22");
                        }                        
                    }
                    catch { 
                        console.log("Address %s token1() threw", a);
                    }                    
                }
                catch { 
                    console.log("Address %s token0() threw", a);
                }
            }
        }
        catch {             
            console.log("Address %s factory() threw", a);
        }
        revert("1");
    }
}