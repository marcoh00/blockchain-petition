// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8;

interface IIDP {
    function submitHash(uint256) external returns (uint256);
    function getHash(uint8) external view returns (uint256, uint256);
    function lastIteration() external view returns (uint8);
    function depth() external view returns (uint8);
}

interface IRegistry {
    function name() external view returns (bytes32);
    function idp() external view returns (IIDP);
    function petitions() external view returns (IPetition[] memory);
}

interface IPetition {
    function name() external view returns (bytes32);
    function description() external view returns (bytes32[] memory);
    function id() external view returns (bytes32);
    function registry() external view returns (IRegistry);
    function sign(uint256[] calldata, uint8, uint256) external;
    function signers() external view returns (uint32);
}