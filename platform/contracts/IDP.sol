// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8;

import "./IPetition.sol";

contract IDP is IIDP {
    uint8 private DEPTH;
    uint8 private pLastIteration;
    uint256 PERIOD_LEN;
    mapping (address => mapping (uint256 => bool)) private authorized;
    event VotingRightAdded(address toAllow,  uint256 indexed period);
    bytes32[255] private pRoot;
    uint256[255] private pRootForPeriod;
    string idpUrl;

    event HashAdded(bytes32 indexed root, uint256 indexed period, uint8 iteration);

    // The lDepth argument needed for zk
    constructor(uint8 lDepth, uint256 lPeriodLen, string memory lidpUrl) {
        DEPTH = lDepth;
        PERIOD_LEN = lPeriodLen;
        idpUrl = lidpUrl;
    }

    // Needed for zk
    function submitHash(bytes32 rt, uint256 designatedPeriod) override external returns (uint256) {
        require(designatedPeriod == period());
        resetIterationCounterIfNeccessary();
        pLastIteration += 1;
        pRoot[pLastIteration] = rt;
        pRootForPeriod[pLastIteration] = designatedPeriod;
        emit HashAdded(rt, designatedPeriod, pLastIteration);
        return pLastIteration;
    }

    // Needed for zk
    function resetIterationCounterIfNeccessary() private {
        uint256 lastPeriod = pRootForPeriod[pLastIteration];
        if(lastPeriod < period()) {
            pLastIteration = 0;
        }
    }

    // Needed for zk
    function getHash(uint8 iteration) override external view returns (bytes32, uint256) {
        require(pRoot[iteration] != 0 && pRootForPeriod[iteration] != 0);
        return (pRoot[iteration], pRootForPeriod[iteration]);
    }

    // Needed for zk
    function lastIteration() override external view returns (uint8) {
        return pLastIteration;
    }

        function submitVotingRight(address toAllow, uint256 designatedPeriod) override external {
        require(designatedPeriod == period());
        authorized[toAllow][designatedPeriod] = true;
        emit VotingRightAdded(toAllow, designatedPeriod);
    }

    function validateAuthorized(address candidate) override external view returns (bool){
        return authorized[candidate][period()];
    }

    // Needed for zk
    function depth() override external view returns (uint8) {
        return DEPTH;
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
        return idpUrl;
    }
}