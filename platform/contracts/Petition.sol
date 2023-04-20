// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8;

import "./IPetition.sol";

contract Petition is IPetition {
    bytes32 private pName;
    string private pDescription;
    bytes32 pId;
    uint256 pPeriod;
    IRegistry private pRegistry;
    uint32 private pSigners;
    mapping(bytes32 => bool) private pHasSigned_zk;
    mapping(address => bool) private pHasSigned;
    bool pHiddenByOperator;

    event PetitionSigned_zk(bytes32 indexed id, bytes32 indexed identity);
    event PetitionSigned(bytes32 indexed id, address indexed identity);

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

    function sign_zk(Verifier.Proof calldata lProof, uint8 lIteration, bytes32 lIdentity) override external {
        require(pHasSigned_zk[lIdentity] == false);
        (bytes32 rt, uint256 rtProofPeriod) = this.registry().idp().getHash(lIteration);
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



        require(this.registry().verifier().verifyTx(lProof, input));
        pHasSigned_zk[lIdentity] = true;
        pSigners += 1;
        emit PetitionSigned_zk(pId, lIdentity);
    }

    function sign() override external {
        require(!pHasSigned[msg.sender]);
        require(this.period() == this.registry().idp().period());
        require(this.registry().idp().validateAuthorized(msg.sender));

        pHasSigned[msg.sender] = true;
        pSigners += 1;
        emit PetitionSigned(pId, msg.sender);
    }

    function hasSigned_zk(uint8 lIteration, bytes32 lIdentity) override external view returns (bool) {
        bool has_signed = pHasSigned_zk[lIdentity] ? true : false;
        if (!has_signed) {
            return false;
        }
        (bytes32 rt, uint256 rtProofPeriod) = this.registry().idp().getHash(lIteration);
        return (rtProofPeriod == this.period()) ? true : false;
    }

    function signers() override external view returns (uint32) {
        return pSigners;
    }

    function hasSigned(address toCheck) override external view returns (uint32) {
        return pHasSigned[toCheck] ? uint32(1) : uint32(0);
    }

    function hide(bool lHidden) external {
        require(msg.sender == address(pRegistry));
        pHiddenByOperator = lHidden;
    }

    function hidden() external view returns (bool) {
        return pHiddenByOperator;
    }
}