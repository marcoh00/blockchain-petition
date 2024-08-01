// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8;

import "./StimmrechtsbeweisVerifier.sol";
import "./IPssVerifier.sol";

enum PetitionType {
    Naive,
    ZK,
    Secp256k1PSS
}

interface IIDP {
    function petitiontype() external view returns (PetitionType);
    function periodlen() external view returns (uint256);
    function period() external view returns (uint256);
    function url() external view returns (string memory);
}

interface INaiveIDP is IIDP {
    function submitVotingRight(address, uint256) external;
    function validateAuthorized(address, uint256) external view returns (bool);
}

interface IZKIDP is IIDP {
    function submitHash(bytes32, uint256) external returns (uint256);
    function getHash(uint8) external view returns (bytes32, uint256);
    function lastIteration() external view returns (uint8);
    function depth() external view returns (uint8);
}

interface IZKVerifier {
    function pk() external view returns (uint256[] memory);
    function vk() external view returns (uint256[] memory);
    function checkProof(bytes calldata, bytes32, bytes32) external view returns (bool);
}

interface IRegistry {
    function name() external view returns (bytes32);
    function idp() external view returns (address);
    function petitions() external view returns (IPetition[] memory);
    function verifier() external view returns (address);
    function petitiontype() external view returns (PetitionType);
}

interface IPetition {
    function name() external view returns (bytes32);
    function description() external view returns (string memory);
    function id() external view returns (bytes32);
    function registry() external view returns (IRegistry);
    function period() external view returns (uint256);    
    function signers() external view returns (uint256);
}

interface INaivePetition is IPetition {
    function sign() external;
    function hasSigned(address) external view returns (bool);
}

interface IZKPetition is IPetition {
    function sign(Verifier.Proof calldata, uint8, bytes32) external;
    function hasSigned(bytes32) external view returns (bool);
}

interface IPSSPetition is IPetition {
    function sign(uint256, uint256, uint256, uint8, uint256) external;
    function hasSigned(uint8, uint256) external view returns (bool);
}
