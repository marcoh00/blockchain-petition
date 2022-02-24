// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8;

import "./IPetition.sol";

contract Verifier is IVerifier {
    function pk() override external view returns (uint256[] memory) {
        uint256[] memory ret = new uint256[](1);
        return ret;
    }
    function vk() override external view returns (uint256[] memory) {
        uint256[] memory ret = new uint256[](1);
        return ret;
    }
    function checkProof(bytes calldata proof, bytes32 rt, bytes32 eid) override external view returns (bool) {
        return true;
    }
}