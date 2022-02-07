// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8;

import "./IPetition.sol";

contract Petition is IPetition {
    bytes32 private pName;
    bytes32[] private pDescription;
    bytes32 pId;
    IRegistry private pRegistry;
    uint32 private pSigners;
    mapping(uint256 => bool) private pHasSigned;

    constructor(bytes32 name, bytes32[] memory description, bytes32 id, address registry) {
        pName = name;
        pDescription = description;
        pId = id;
        pRegistry = IRegistry(registry);
    }

    function name() override external view returns (bytes32) {
        return pName;
    }

    function description() override external view returns (bytes32[] memory) {
        return pDescription;
    }

    function id() override external view returns (bytes32) {
        return pId;
    }

    function registry() override external view returns (IRegistry) {
        return pRegistry;
    }

    function sign(uint256[] calldata proof, uint8 iteration, uint256 identity) override external {
        require(pHasSigned[identity] == false);
        (uint256 rt, uint256 creation) = this.registry().idp().getHash(iteration);
        require(block.timestamp < creation + 1 weeks);
        require(true /* TODO: Verify proof */);
        pHasSigned[identity] = true;
        pSigners += 1;
    }

    function signers() override external view returns (uint32) {
        return pSigners;
    }
}