// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8;

import "./IPetition.sol";

contract Petition is IPetition {
    bytes32 private pName;
    string private pDescription;
    bytes32 pId;
    uint256 pPeriod;
    IRegistry private pRegistry;
    uint32 private pSigners;
    mapping(address => bool) private pHasSigned;
    bool pHiddenByOperator;

    event PetitionSigned(bytes32 indexed id, address indexed identity);

    constructor(bytes32 lName, string memory lDescription, bytes32 lId, uint256 lPeriod, address lRegistry, bool lHidden) {
        pName = lName;
        pDescription = lDescription;
        pId = lId;
        pPeriod = lPeriod;
        pRegistry = IRegistry(lRegistry);
        pHiddenByOperator = lHidden;
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

    function period() override external view returns (uint256) {
        return pPeriod;
    }

    function sign() override external {
        require(!pHasSigned[msg.sender]);
        require(this.registry().idp().validateAuthorized(msg.sender));

        pHasSigned[msg.sender] = true;
        pSigners += 1;
        emit PetitionSigned(pId, msg.sender);
    }

    function signers() override external view returns (uint32) {
        return pSigners;
    }

    function hide(bool lHidden) external {
        require(msg.sender == address(pRegistry));
        pHiddenByOperator = lHidden;
    }

    function hidden() external view returns (bool) {
        return pHiddenByOperator;
    }
}