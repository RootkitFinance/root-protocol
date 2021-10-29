// SPDX-License-Identifier: J-J-J-JENGA!!!
pragma solidity ^0.7.4;

import "./Owned.sol";
import "./Arbitrage.sol";
import "./LiquidityController.sol";
import "./Timers.sol";

contract RootKitGovSurface.sol is Owned, Arbitrage, LiquidityController, Timers {
    
    address public Snapshot;
    address public Governator;
    
    
    
    modifier onlySnapshot(){
        require(msg.sender == Snapshot, "Governance");
        _;
    }
    event SnapshotTransfered(address indexed previousSnapshot, address indexed newSnapshot);
    
    function setSnapshot(address _Snapshot) onlyOwner(){
        
    }
    
    modifier onlyGovernator(){
        require(msg.sender == Governator, "Not Governator");
        _;
    }
    
}
