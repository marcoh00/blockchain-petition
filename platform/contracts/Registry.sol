// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8;

import "./IPetition.sol";
import "./Petition.sol";

contract Registry is IRegistry {
    IPetition[] private pPetitions;
    IIDP private pIDP;
    IVerifier private pVerifier;
    bytes32 private pName;
    uint256 petitionId;

    constructor(bytes32 name, address idp, address verifier) {
        pName = name;
        pIDP = IIDP(idp);
        pVerifier = IVerifier(verifier);
    }

    function name() override external view returns (bytes32) {
        return pName;
    }

    function idp() override external view returns (IIDP) {
        return pIDP;
    }

    function petitions() override external view returns (IPetition[] memory) {
        return pPetitions;
    }

    function verifier() override external view returns (IVerifier) {
        return pVerifier;
    }

    function createPetition(bytes32 name, string calldata description) external {
        petitionId += 1;

        pPetitions.push(
            new Petition(name, description, keccak256(abi.encode(bytes32(petitionId) ^ name)), address(this))
        );
    }
}