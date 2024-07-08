// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8;

import "./IPetition.sol";

abstract contract IDP is IIDP {

    uint256 PERIOD_LEN;
    string idpUrl;

    constructor(uint256 lPeriodLen, string memory lidpUrl) {
        PERIOD_LEN = lPeriodLen;
        idpUrl = lidpUrl;
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

contract ZKIDP is IZKIDP, IDP {
    uint8 private DEPTH;
    uint8 private pLastIteration;
    bytes32[255] private pRoot;
    uint256[255] private pRootForPeriod;

    event HashAdded(
        bytes32 indexed root,
        uint256 indexed period,
        uint8 iteration
    );

    constructor(
        uint256 lPeriodLen,
        string memory lidpUrl,
        uint8 lDepth
    ) IDP(lPeriodLen, lidpUrl) {
        DEPTH = lDepth;
    }

    function depth() external view override returns (uint8) {
        return DEPTH;
    }

    function submitHash(
        bytes32 rt,
        uint256 designatedPeriod
    ) external override returns (uint256) {
        require(designatedPeriod == period());
        resetIterationCounterIfNeccessary();
        pLastIteration += 1;
        pRoot[pLastIteration] = rt;
        pRootForPeriod[pLastIteration] = designatedPeriod;
        emit HashAdded(rt, designatedPeriod, pLastIteration);
        return pLastIteration;
    }

    function resetIterationCounterIfNeccessary() private {
        uint256 lastPeriod = pRootForPeriod[pLastIteration];
        if (lastPeriod < period()) {
            pLastIteration = 0;
        }
    }

    function getHash(
        uint8 iteration
    ) external view override returns (bytes32, uint256) {
        require(pRoot[iteration] != 0 && pRootForPeriod[iteration] != 0);
        return (pRoot[iteration], pRootForPeriod[iteration]);
    }

    function lastIteration() external view override returns (uint8) {
        return pLastIteration;
    }

    function petitiontype() external pure override returns (PetitionType) {
        return PetitionType.ZK;
    }
}

contract NaiveIDP is INaiveIDP, IDP {
    mapping(address => mapping(uint256 => bool)) private authorized;

    event VotingRightAdded(address toAllow, uint256 indexed period);

    constructor(
        uint256 lPeriodLen,
        string memory lidpUrl
    ) IDP(lPeriodLen, lidpUrl) {}

    function submitVotingRight(
        address toAllow,
        uint256 designatedPeriod
    ) external override {
        require(designatedPeriod == period());
        authorized[toAllow][designatedPeriod] = true;
        emit VotingRightAdded(toAllow, designatedPeriod);
    }

    function validateAuthorized(
        address candidate,
        uint256 authorized_for_period
    ) external view override returns (bool) {
        return authorized[candidate][authorized_for_period];
    }

    function petitiontype() external pure override returns (PetitionType) {
        return PetitionType.Naive;
    }
}