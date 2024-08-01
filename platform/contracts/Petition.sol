// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8;

import "./IPetition.sol";

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

        //Überführe die öffentlichen Eingabewerte des Stimmrechtsbeweises in die erwartete Form: Eingabewerte, portioniert auf 32Bit, zusammen in einem uint[24] Array
        uint[24] memory input;
        int inputPosition = 23;

        for(uint i=0; i<8; i++){
            input[uint256(inputPosition)] = uint(pId >> (32 * i)) & 0xFFFFFFFF;
            inputPosition --;
        }
        for(uint i=0; i<8; i++){
            input[uint256(inputPosition)] = uint(lIdentity >> (32 * i)) & 0xFFFFFFFF;
            inputPosition --;
        }
        for(uint i=0; i<8; i++){
            input[uint256(inputPosition)] = uint(rt >> (32 * i)) & 0xFFFFFFFF;
            inputPosition --;
        }

        require(Verifier(pRegistry.verifier()).verifyTx(lProof, input));
        pHasSigned_zk[lIdentity] = true;
        pSigners += 1;
        emit PetitionSigned(pId, lIdentity);
    }

    function hasSigned(bytes32 lIdentity) override external view returns (bool) {
        return pHasSigned_zk[lIdentity];
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

    function sign(uint256 c, uint256 s1, uint256 s2, uint8 i_sector_icc_1_parity, uint256 i_sector_icc_1_x) external override {
        bytes32 identity = keccak256(abi.encodePacked(i_sector_icc_1_parity, i_sector_icc_1_x));
        require(!pHasSigned[identity]);
        require(
            IPssVerifier(this.registry().verifier())
            .validate_signature_p1(
                bytes.concat(pId),
                c,
                s1,
                s2,
                i_sector_icc_1_parity,
                i_sector_icc_1_x
            )
        );
        pHasSigned[identity] = true;
        pSigners += 1;
        emit PetitionSigned(pId, identity);
    }

    function hasSigned(uint8 i_sector_icc_1_parity, uint256 i_sector_icc_1_x) override external view returns (bool) {
        bytes32 identity = keccak256(abi.encodePacked(i_sector_icc_1_parity, i_sector_icc_1_x));
        return pHasSigned[identity];
    }
}
