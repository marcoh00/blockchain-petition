// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8;

import "./IPetition.sol";
import "./IDP.sol";
import "@semaphore-protocol/contracts/Semaphore.sol";

abstract contract Petition is IPetition {
    bytes32 private pName;
    string private pDescription;
    bytes32 pId;
    uint256 pPeriod;
    IRegistry internal pRegistry;
    uint256 internal pSigners;
    bool pHiddenByOperator;

    event PetitionSigned(bytes32 indexed id, bytes32 indexed identity);

    constructor(bytes32 lName, string memory lDescription, bytes32 lId, uint256 lPeriod, address lRegistry, bool lHidden) {
        pName = lName;
        pDescription = lDescription;
        pId = lId;
        pPeriod = lPeriod;
        pRegistry = IRegistry(lRegistry);
        pHiddenByOperator = lHidden;
    }

    // receive() and fallback() added due to this issue
    // https://stackoverflow.com/questions/72101643/hardhat-what-are-the-strange-calls-to-my-smart-contract
    receive() external payable {}

    // * fallback function
    fallback() external payable {}

    function name() override external view returns (bytes32) {
        return pName;
    }

    function description() override external view returns (string memory) {
        return pDescription;
    }

    function id() override external view returns (bytes32) {
        return pId;
    }

    function registry() override external view returns (IRegistry) {
        return pRegistry;
    }

    function period() override external view returns (uint256) {
        return pPeriod;
    }

    function signers() override external view returns (uint256) {
        return pSigners;
    }

    function hide(bool lHidden) external {
        require(msg.sender == address(pRegistry));
        pHiddenByOperator = lHidden;
    }

    function hidden() external view returns (bool) {
        return pHiddenByOperator;
    }
}

contract NaivePetition is Petition, INaivePetition {
    mapping(address => bool) private pHasSigned;

    constructor(bytes32 lName, string memory lDescription, bytes32 lId, uint256 lPeriod, address lRegistry, bool lHidden) Petition(lName, lDescription, lId, lPeriod, lRegistry, lHidden) {}

    function sign() override external {
        require(!pHasSigned[msg.sender]);
        require(this.period() == INaiveIDP(this.registry().idp()).period());
        require(INaiveIDP(this.registry().idp()).validateAuthorized(msg.sender, pPeriod));

        pHasSigned[msg.sender] = true;
        pSigners += 1;
        emit PetitionSigned(pId, bytes32(uint256(uint160(msg.sender))));
    }

    function hasSigned(address toCheck) override external view returns (bool) {
        return pHasSigned[toCheck];
    }
}

contract ZKPetition is Petition, IZKPetition {
    mapping(bytes32 => bool) private pHasSigned_zk;

    constructor(bytes32 lName, string memory lDescription, bytes32 lId, uint256 lPeriod, address lRegistry, bool lHidden) Petition(lName, lDescription, lId, lPeriod, lRegistry, lHidden) {}
    
    function sign(Verifier.Proof calldata lProof, uint8 lIteration, bytes32 lIdentity) override external {
        require(pHasSigned_zk[lIdentity] == false);
        (bytes32 rt, uint256 rtProofPeriod) = IZKIDP(this.registry().idp()).getHash(lIteration);
        require(rtProofPeriod == this.period());

        // Construct the expected public inputs to the proof on-chain, as far as possible
        // An alternative would be to let the client construct & submit everything and check that it matches the state of the blockchain
        // However, this would probably be more expensive in terms of gas, as computation is generally cheaper than storage and we already have the data!

        // Zokrates expects an array w/ 4 bytes/32 bit of data per uint256
        // input[24] is made up like this:
        // input[0..8]   = rt (merkle root hash)    [on-chain]
        // input[8..16]  = lIdentity                [user-provided, as private data is used to construct this]
        // input[16..24] = pId (Petition ID)        [on-chain]
        uint[24] memory input;
        _bytes32Into32BitChunkedArray(rt, input, 0);
        _bytes32Into32BitChunkedArray(lIdentity, input, 8);
        _bytes32Into32BitChunkedArray(pId, input, 16);

        // int inputPosition = 23;

        // for(uint i=0; i<8; i++){
        //     input[uint256(inputPosition)] = uint(pId >> (32 * i)) & 0xFFFFFFFF;
        //     inputPosition --;
        // }
        // for(uint i=0; i<8; i++){
        //     input[uint256(inputPosition)] = uint(lIdentity >> (32 * i)) & 0xFFFFFFFF;
        //     inputPosition --;
        // }
        // for(uint i=0; i<8; i++){
        //     input[uint256(inputPosition)] = uint(rt >> (32 * i)) & 0xFFFFFFFF;
        //     inputPosition --;
        // }

        require(Verifier(pRegistry.verifier()).verifyTx(lProof, input));
        pHasSigned_zk[lIdentity] = true;
        pSigners += 1;
        emit PetitionSigned(pId, lIdentity);
    }

    function hasSigned(bytes32 lIdentity) override external view returns (bool) {
        return pHasSigned_zk[lIdentity];
    }

    function _bytes32Into32BitChunkedArray(bytes32 input, uint256[24] memory array, uint256 start_index) private pure {
        for(uint256 i = 0; i < 8; i++) {
            array[start_index + i] = uint256(input >> 32 * (7 - i)) & 0xFFFFFFFF;
        }
    }
}

contract PSSPetition is Petition, IPSSPetition {
    mapping(bytes32 => bool) private pHasSigned;

    constructor(
        bytes32 lName,
        string memory lDescription,
        bytes32 lId,
        uint256 lPeriod,
        address lRegistry,
        bool lHidden
    ) Petition(lName, lDescription, lId, lPeriod, lRegistry, lHidden) {}

    function sign(uint256 c, uint256 s1, uint256 s2, ECC.Point memory i_sector_icc_1) external override {
        bytes32 identity = keccak256(abi.encodePacked(i_sector_icc_1.X, i_sector_icc_1.Y));
        require(!pHasSigned[identity]);
        require(
            IPssVerifier(this.registry().verifier())
            .validate_signature_p1(
                bytes.concat(pId),
                c,
                s1,
                s2,
                i_sector_icc_1
            )
        );
        pHasSigned[identity] = true;
        pSigners += 1;
        emit PetitionSigned(pId, identity);
    }

    function hasSigned(ECC.Point memory i_sector_icc_1) override external view returns (bool) {
        bytes32 identity = keccak256(abi.encodePacked(i_sector_icc_1.X, i_sector_icc_1.Y));
        return pHasSigned[identity];
    }
}

contract SemaphorePetition is Petition, ISemaphorePetition {
    mapping(bytes32 => bool) private pHasSigned;

    constructor(
        bytes32 lName,
        string memory lDescription,
        bytes32 lId,
        uint256 lPeriod,
        address lRegistry,
        bool lHidden
    ) Petition(lName, lDescription, lId, lPeriod, lRegistry, lHidden) {}

    function sign(
        uint256 merkleTreeDepth,
        uint256 merkleTreeRoot,
        uint256 nullifier,
        uint256[8] calldata points
    ) external override {
        SemaphoreIDP(pRegistry.idp()).validateProof(
            merkleTreeDepth,
            merkleTreeRoot,
            nullifier,
            1936287598,         // message = "sign" => (1936287598).to_bytes(4) = b'sign'
            uint256(pId),       // topic is the petition id
            points
        );

        pSigners += 1;
        emit PetitionSigned(pId, bytes32(nullifier));
    }
}