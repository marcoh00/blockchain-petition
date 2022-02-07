// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8;

import "./IPetition.sol";

contract IDP is IIDP {
    uint8 DEPTH;
    uint256[255] private root;
    uint256[255] private creation;
    uint8 private pLastIteration;

    constructor(uint8 mkdepth) {
        DEPTH = mkdepth;
    }

    function submitHash(uint256 rt) override external returns (uint256) {
        require(creation[pLastIteration] + 45 minutes < block.timestamp);
        unchecked {
            pLastIteration += 1;
        }
        root[pLastIteration] = rt;
        creation[pLastIteration] = block.timestamp;
        return pLastIteration;
    }

    function getHash(uint8 iteration) override external view returns (uint256, uint256) {
        require(root[iteration] != 0 && creation[iteration] != 0);
        require(creation[iteration] + 2 weeks > block.timestamp);
        return (root[iteration], creation[iteration]);
    }

    function lastIteration() override external view returns (uint8) {
        return pLastIteration;
    }

    function depth() override external view returns (uint8) {
        return DEPTH;
    }
}