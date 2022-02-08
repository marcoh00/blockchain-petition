// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8;

import "./IPetition.sol";

contract IDP is IIDP {
    uint8 private DEPTH;
    uint8 private pLastIteration;
    uint256 PERIOD_LEN;
    uint256[255] private pRoot;
    uint256[255] private pRootForPeriod;

    constructor(uint8 lDepth, uint256 lPeriodLen) {
        DEPTH = lDepth;
        PERIOD_LEN = lPeriodLen;
    }

    function submitHash(uint256 rt) override external returns (uint256) {
        pLastIteration += 1;
        pRoot[pLastIteration] = rt;
        pRootForPeriod[pLastIteration] = period();
        return pLastIteration;
    }

    function resetIterationCounterIfNeccessary() private {
        uint256 lastPeriod = pRootForPeriod[pLastIteration];
        if(lastPeriod < period()) {
            pLastIteration = 0;
        }
    }

    function getHash(uint8 iteration) override external view returns (uint256, uint256) {
        require(pRoot[iteration] != 0 && pRootForPeriod[iteration] != 0);
        return (pRoot[iteration], pRootForPeriod[iteration]);
    }

    function lastIteration() override external view returns (uint8) {
        return pLastIteration;
    }

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
        return "http://localhost:65535";
    }
}