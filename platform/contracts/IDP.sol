// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8;

import "./IPetition.sol";

contract IDP is IIDP {
    uint256 PERIOD_LEN;
    mapping (address => mapping (uint256 => bool)) private authorized;
    event VotingRightAdded(address toAllow,  uint256 indexed period);

    constructor(uint256 lPeriodLen) {
        PERIOD_LEN = lPeriodLen;
    }

    function submitVotingRight(address toAllow, uint256 designatedPeriod) override external {
        require(designatedPeriod == period());
        authorized[toAllow][designatedPeriod] = true;
        emit VotingRightAdded(toAllow, designatedPeriod);
    }

    function validateAuthorized(address candidate) override external view returns (bool){
        return authorized[candidate][period()];
    }

    function periodlen() override external view returns (uint256) {
        return PERIOD_LEN;
    }

    function period() override public view returns (uint256) {
        return block.timestamp / PERIOD_LEN;
    }

    function start_period(uint256 lPeriod) public view returns (uint256) {
        return lPeriod * PERIOD_LEN;
    }

    function end_period(uint256 lPeriod) public view returns (uint256) {
        return start_period(lPeriod) + PERIOD_LEN;
    }

    function url() override external view returns (string memory) {
return "http://localhost:65535"; // replace
    }
}