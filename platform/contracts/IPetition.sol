// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8;


interface IIDP {
    function submitVotingRight(address, uint256) external;
    function validateAuthorized(address) external view returns (bool);
    function periodlen() external view returns (uint256);
    function period() external view returns (uint256);
    function url() external view returns (string memory);
}

interface IRegistry {
    function name() external view returns (bytes32);
    function idp() external view returns (IIDP);
    function petitions() external view returns (IPetition[] memory);
}

interface IPetition {
    function name() external view returns (bytes32);
    function description() external view returns (string memory);
    function id() external view returns (bytes32);
    function registry() external view returns (IRegistry);
    function period() external view returns (uint256);
    function sign() external;
    function signers() external view returns (uint32);
}