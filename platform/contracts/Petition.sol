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
    mapping(bytes32 => bool) private pHasSigned;

    constructor(bytes32 lName, string memory lDescription, bytes32 lId, uint256 lPeriod, address lRegistry) {
        pName = lName;
        pDescription = lDescription;
        pId = lId;
        pPeriod = lPeriod;
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

    function period() override external view returns (uint256) {
        return pPeriod;
    }

    function sign(Verifier.Proof calldata lProof, uint8 lIteration, bytes32 lIdentity) override external {
        require(pHasSigned[lIdentity] == false);
        (bytes32 rt, uint256 rtProofPeriod) = this.registry().idp().getHash(lIteration);
        require(rtProofPeriod == this.period());

        //Überführe die öffentlichen Eingabewerte des Stimmrechtsbeweises in die erwartete Form: Eingabewerte, portioniert auf 32Bit, zusammen in einem uint[24] Array
        uint[24] memory input;
        int inputPosition = 23;

        for(uint i=0; i<8; i++){
            input[uint256(inputPosition)] = uint(pId >> (32 * i)) & 0xFFFFFFFF;
            inputPosition --;
        }
        for(uint i=0; i<8; i++){
            input[uint256(inputPosition)] = uint(lIdentity >> (32 * i)) & 0xFFFFFFFF;
            inputPosition --;
        }
        for(uint i=0; i<8; i++){
            input[uint256(inputPosition)] = uint(rt >> (32 * i)) & 0xFFFFFFFF;
            inputPosition --;
        }



        require(this.registry().verifier().verifyTx(lProof, input));
        pHasSigned[lIdentity] = true;
        pSigners += 1;
    }

    function signers() override external view returns (uint32) {
        return pSigners;
    }
}