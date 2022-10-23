// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8;

import "./IPetition.sol";
import "./Petition.sol";

contract Registry is IRegistry {
    IPetition[] private pPetitions;
    IIDP private pIDP;
    Verifier private pVerifier;
    bytes32 private pName;
    uint256 petitionId;
    bool pHideByDefault;

    event PetitionCreated(bytes32 indexed internalId, uint256 indexed period, bytes32 name, uint256 index);

    constructor(bytes32 lName, address lIdp, address lVerifier) {
        pName = lName;
        pIDP = IIDP(lIdp);
        pVerifier = Verifier(lVerifier);
        pHideByDefault = false;
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

    function verifier() override external view returns (Verifier) {
        return pVerifier;
    }

    function createPetition(bytes32 lName, string calldata description, uint256 period) external {
        require(period == 0 || period >= pIDP.period());
        if(period == 0) {
            period = pIDP.period() + 1;
        }
        petitionId += 1;
        bytes32 lInternalPetitionId = keccak256(abi.encode(bytes32(petitionId) ^ lName));
        pPetitions.push(
            new Petition(lName, description, lInternalPetitionId, period, address(this), pHideByDefault)
        );
        emit PetitionCreated(lInternalPetitionId, period, lName, pPetitions.length);
    }
}