// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8;

import "./IPetition.sol";

contract IDP is IIDP {
    uint8 DEPTH;
    uint256 VALIDITY;
    uint256[255] private root;
    uint256[255] private creation;
    uint8 private pLastIteration;

    constructor(uint8 mkdepth, uint256 valid) {
        DEPTH = mkdepth;
        VALIDITY = valid;
    }

    function submitHash(uint256 rt) override external returns (uint256) {
        uint256 SAFETY_PERIOD = (11 * VALIDITY) / (255 * 10);
        require(creation[pLastIteration] + SAFETY_PERIOD < block.timestamp);
        unchecked {
            pLastIteration += 1;
        }
        root[pLastIteration] = rt;
        creation[pLastIteration] = block.timestamp;
        return pLastIteration;
    }

    function getHash(uint8 iteration) override external view returns (uint256, uint256) {
        require(root[iteration] != 0 && creation[iteration] != 0);
        require(creation[iteration] + (2 * VALIDITY) > block.timestamp);
        return (root[iteration], creation[iteration]);
    }

    function lastIteration() override external view returns (uint8) {
        return pLastIteration;
    }

    function depth() override external view returns (uint8) {
        return DEPTH;
    }

    function validity() override external view returns (uint256) {
        return VALIDITY;
    }

    function url() override external view returns (string memory) {
        return "http://localhost:65535";
    }
}