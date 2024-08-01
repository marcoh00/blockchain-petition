// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8;

import "./IPetition.sol";
import "./Petition.sol";

contract Registry is IRegistry {
    IPetition[] private pPetitions;
    address private pIDP;
    address private pVerifier;
    bytes32 private pName;
    uint256 petitionId;
    bool pHideByDefault;
    PetitionType pPetitionType;

    event PetitionCreated(
        bytes32 indexed internalId,
        uint256 indexed period,
        bytes32 name,
        uint256 index
    );

    constructor(
        bytes32 lName,
        address lIdp,
        address lVerifier,
        PetitionType lPetitionType
    ) {
        pName = lName;
        pIDP = lIdp;
        pHideByDefault = false;
        pPetitionType = lPetitionType;
        require(IIDP(lIdp).petitiontype() == lPetitionType);

        if(lPetitionType == PetitionType.ZK || lPetitionType == PetitionType.Secp256k1PSS) {
            pVerifier = lVerifier;
        }
    }

    function name() external view override returns (bytes32) {
        return pName;
    }

    function idp() external view override returns (address) {
        return pIDP;
    }

    function petitions() external view override returns (IPetition[] memory) {
        return pPetitions;
    }

    function verifier() external view override returns (address) {
        return pVerifier;
    }

    function createPetition(
        bytes32 lName,
        string calldata description,
        uint256 period
    ) external {
        require(period == 0 || period >= IIDP(pIDP).period());
        if (period == 0) {
            period = IIDP(pIDP).period() + 1;
        }
        petitionId += 1;
        bytes32 lInternalPetitionId = keccak256(
            abi.encodePacked(address(this), petitionId, lName)
        );

        if (pPetitionType == PetitionType.Naive) {
            pPetitions.push(
                new NaivePetition(
                    lName,
                    description,
                    lInternalPetitionId,
                    period,
                    address(this),
                    pHideByDefault
                )
            );
        } else if (pPetitionType == PetitionType.ZK) {
            pPetitions.push(
                new ZKPetition(
                    lName,
                    description,
                    lInternalPetitionId,
                    period,
                    address(this),
                    pHideByDefault
                )
            );
        } else if (pPetitionType == PetitionType.Secp256k1PSS) {
            pPetitions.push(
                new PSSPetition(
                    lName,
                    description,
                    lInternalPetitionId,
                    period,
                    address(this),
                    pHideByDefault
                )
            );
        } else {
            revert();
        }

        emit PetitionCreated(
            lInternalPetitionId,
            period,
            lName,
            pPetitions.length
        );
    }

    function petitiontype() external view override returns (PetitionType) {
        return pPetitionType;
    }
}