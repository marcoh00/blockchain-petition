// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8;

import "./IPetition.sol";
import "@semaphore-protocol/contracts/base/SemaphoreVerifier.sol";
import "@semaphore-protocol/contracts/interfaces/ISemaphore.sol";
import "@semaphore-protocol/contracts/Semaphore.sol";


abstract contract IDP is IIDP {

    uint256 PERIOD_LEN;
    string idpUrl;
    address operator;

    constructor(uint256 lPeriodLen, string memory lidpUrl) {
        PERIOD_LEN = lPeriodLen;
        idpUrl = lidpUrl;
        operator = msg.sender;
    }

    function change_operator(address new_operator) override external {
        require(msg.sender == operator);
        operator = new_operator;
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
        require(msg.sender == operator);
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
        require(msg.sender == operator);
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

contract PSSIDP is IDP {
    PetitionType psstype;

    constructor(
        string memory lidpUrl,
        PetitionType _type
    ) IDP(315360000, lidpUrl) {
        require(_type == PetitionType.AltBn128PSS || _type == PetitionType.Secp256k1PSS);
        psstype = _type;
    }

    function petitiontype() external view override returns (PetitionType) {
        return psstype;
    }
}

contract SemaphoreIDP is IDP, ISemaphoreIDP {
    Semaphore private _semaphore;
    uint256 private _groupId;

    constructor(string memory lidpUrl) IDP(315360000, lidpUrl) {
        SemaphoreVerifier verifier = new SemaphoreVerifier();
        _semaphore = new Semaphore(ISemaphoreVerifier(address(verifier)));
        _groupId = _semaphore.createGroup(address(this), 315360000 / 12);
    }

    function addMember(uint256 identity_commitment) external {
        require(msg.sender == operator);
        _semaphore.addMember(_groupId, identity_commitment);
    }

    function addMembers(uint256[] calldata identity_commitments) external override {
        require(msg.sender == operator);
        _semaphore.addMembers(_groupId, identity_commitments);
    }

    function validateProof(
        uint256 merkleTreeDepth,
        uint256 merkleTreeRoot,
        uint256 nullifier,
        uint256 message,
        uint256 scope,
        uint256[8] calldata points
    ) external {
        ISemaphore.SemaphoreProof memory proof = ISemaphore.SemaphoreProof(
            merkleTreeDepth,
            merkleTreeRoot,
            nullifier,
            message,
            scope,
            points
        );
        _semaphore.validateProof(_groupId, proof);
    }

    function getSemaphore() external view returns (address) {
        return address(_semaphore);
    }

    function getMerkleTreeRoot()
        public
        view
        virtual
        override
        returns (uint256)
    {
        return _semaphore.getMerkleTreeRoot(_groupId);
    }

    function getMerkleTreeDepth()
        public
        view
        virtual
        override
        returns (uint256)
    {
        return _semaphore.getMerkleTreeDepth(_groupId);
    }

    function getMerkleTreeSize()
        public
        view
        virtual
        override
        returns (uint256)
    {
        return _semaphore.getMerkleTreeSize(_groupId);
    }

    function petitiontype() external pure override returns (PetitionType) {
        return PetitionType.Semaphore;
    }
}