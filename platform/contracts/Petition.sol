// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8;

import "./IPetition.sol";

contract Petition is IPetition {
    bytes32 private pName;
    string private pDescription;
    bytes32 pId;
    IRegistry private pRegistry;
    uint32 private pSigners;
    mapping(uint256 => bool) private pHasSigned;

    constructor(bytes32 lName, string memory lDescription, bytes32 lId, address lRegistry) {
        pName = lName;
        pDescription = lDescription;
        pId = lId;
        pRegistry = IRegistry(lRegistry);
    }

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

    function sign(bytes calldata lProof, uint8 lIteration, uint256 lIdentity) override external {
        require(pHasSigned[lIdentity] == false);
        (uint256 rt, uint256 creation) = this.registry().idp().getHash(lIteration);
        require(block.timestamp < creation + this.registry().idp().validity());
        require(this.registry().verifier().checkProof(lProof, rt, pId));
        pHasSigned[lIdentity] = true;
        pSigners += 1;
    }

    function signers() override external view returns (uint32) {
        return pSigners;
    }
}