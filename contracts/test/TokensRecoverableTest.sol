// SPDX-License-Identifier: J-J-J-JENGA!!!
pragma solidity ^0.7.4;

import "../TokensRecoverable.sol";

contract TokensRecoverableTest is TokensRecoverable
{
    bool canRecover;

    function setCanRecover(bool can) public
    {
        canRecover = can;
    }

    function canRecoverTokens(IERC20) internal override view returns (bool) { 
        return canRecover;
    }
}