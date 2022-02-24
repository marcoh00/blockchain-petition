// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8;

interface IIDP {
    function submitHash(bytes32, uint256) external returns (uint256);
    function getHash(uint8) external view returns (bytes32, uint256);
    function lastIteration() external view returns (uint8);
    function depth() external view returns (uint8);
    function periodlen() external view returns (uint256);
    function period() external view returns (uint256);
    function url() external view returns (string memory);
}

interface IVerifier {
    function pk() external view returns (uint256[] memory);
    function vk() external view returns (uint256[] memory);
    function checkProof(bytes calldata, bytes32, bytes32) external view returns (bool);
}

interface IRegistry {
    function name() external view returns (bytes32);
    function idp() external view returns (IIDP);
    function petitions() external view returns (IPetition[] memory);
    function verifier() external view returns (IVerifier);
}

interface IPetition {
    function name() external view returns (bytes32);
    function description() external view returns (string memory);
    function id() external view returns (bytes32);
    function registry() external view returns (IRegistry);
    function period() external view returns (uint256);
    function sign(bytes calldata, uint8, uint256) external;
    function signers() external view returns (uint32);
}