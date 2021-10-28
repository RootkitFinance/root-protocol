// SPDX-License-Identifier: J-J-J-JENGA!!!
pragma solidity ^0.7.4;

import "./Owned.sol";

contract Timers is Owned  {
    
    uint256 _timeRequired;
    uint256 _notBefore;
    
    function setHoursRequired(uint256 _hoursRequired) public ownerOnly(){
        
        _timeRequired = _hoursRequired * 1 hours;
        
    } 
    
    function setDaysRequired(uint256 _daysRequired) public ownerOnly(){
        
        _timeRequired = _daysRequired * 1 days;
        
    }
    
    function setWeeksRequired(uint256 _weeksRequired) public ownerOnly(){
        
        _timeRequired = _weeksRequired * 1 weeks;
        
    }
    
    function _startTimer() internal {
        uint256 _now = block.timestamp;
         _notBefore = _now + _timeRequired;
    }
}