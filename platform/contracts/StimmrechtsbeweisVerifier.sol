// This file is MIT Licensed.
//
// Copyright 2017 Christian Reitwiessner
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
pragma solidity ^0.8.0;
library Pairing {
    struct G1Point {
        uint X;
        uint Y;
    }
    // Encoding of field elements is: X[0] * z + X[1]
    struct G2Point {
        uint[2] X;
        uint[2] Y;
    }
    /// @return the generator of G1
    function P1() pure internal returns (G1Point memory) {
        return G1Point(1, 2);
    }
    /// @return the generator of G2
    function P2() pure internal returns (G2Point memory) {
        return G2Point(
            [10857046999023057135944570762232829481370756359578518086990519993285655852781,
             11559732032986387107991004021392285783925812861821192530917403151452391805634],
            [8495653923123431417604973247489272438418190587263600148770280649306958101930,
             4082367875863433681332203403145435568316851327593401208105741076214120093531]
        );
    }
    /// @return the negation of p, i.e. p.addition(p.negate()) should be zero.
    function negate(G1Point memory p) pure internal returns (G1Point memory) {
        // The prime q in the base field F_q for G1
        uint q = 21888242871839275222246405745257275088696311157297823662689037894645226208583;
        if (p.X == 0 && p.Y == 0)
            return G1Point(0, 0);
        return G1Point(p.X, q - (p.Y % q));
    }
    /// @return r the sum of two points of G1
    function addition(G1Point memory p1, G1Point memory p2) internal view returns (G1Point memory r) {
        uint[4] memory input;
        input[0] = p1.X;
        input[1] = p1.Y;
        input[2] = p2.X;
        input[3] = p2.Y;
        bool success;
        assembly {
            success := staticcall(sub(gas(), 2000), 6, input, 0xc0, r, 0x60)
            // Use "invalid" to make gas estimation work
            switch success case 0 { invalid() }
        }
        require(success);
    }


    /// @return r the product of a point on G1 and a scalar, i.e.
    /// p == p.scalar_mul(1) and p.addition(p) == p.scalar_mul(2) for all points p.
    function scalar_mul(G1Point memory p, uint s) internal view returns (G1Point memory r) {
        uint[3] memory input;
        input[0] = p.X;
        input[1] = p.Y;
        input[2] = s;
        bool success;
        assembly {
            success := staticcall(sub(gas(), 2000), 7, input, 0x80, r, 0x60)
            // Use "invalid" to make gas estimation work
            switch success case 0 { invalid() }
        }
        require (success);
    }
    /// @return the result of computing the pairing check
    /// e(p1[0], p2[0]) *  .... * e(p1[n], p2[n]) == 1
    /// For example pairing([P1(), P1().negate()], [P2(), P2()]) should
    /// return true.
    function pairing(G1Point[] memory p1, G2Point[] memory p2) internal view returns (bool) {
        require(p1.length == p2.length);
        uint elements = p1.length;
        uint inputSize = elements * 6;
        uint[] memory input = new uint[](inputSize);
        for (uint i = 0; i < elements; i++)
        {
            input[i * 6 + 0] = p1[i].X;
            input[i * 6 + 1] = p1[i].Y;
            input[i * 6 + 2] = p2[i].X[1];
            input[i * 6 + 3] = p2[i].X[0];
            input[i * 6 + 4] = p2[i].Y[1];
            input[i * 6 + 5] = p2[i].Y[0];
        }
        uint[1] memory out;
        bool success;
        assembly {
            success := staticcall(sub(gas(), 2000), 8, add(input, 0x20), mul(inputSize, 0x20), out, 0x20)
            // Use "invalid" to make gas estimation work
            switch success case 0 { invalid() }
        }
        require(success);
        return out[0] != 0;
    }
    /// Convenience method for a pairing check for two pairs.
    function pairingProd2(G1Point memory a1, G2Point memory a2, G1Point memory b1, G2Point memory b2) internal view returns (bool) {
        G1Point[] memory p1 = new G1Point[](2);
        G2Point[] memory p2 = new G2Point[](2);
        p1[0] = a1;
        p1[1] = b1;
        p2[0] = a2;
        p2[1] = b2;
        return pairing(p1, p2);
    }
    /// Convenience method for a pairing check for three pairs.
    function pairingProd3(
            G1Point memory a1, G2Point memory a2,
            G1Point memory b1, G2Point memory b2,
            G1Point memory c1, G2Point memory c2
    ) internal view returns (bool) {
        G1Point[] memory p1 = new G1Point[](3);
        G2Point[] memory p2 = new G2Point[](3);
        p1[0] = a1;
        p1[1] = b1;
        p1[2] = c1;
        p2[0] = a2;
        p2[1] = b2;
        p2[2] = c2;
        return pairing(p1, p2);
    }
    /// Convenience method for a pairing check for four pairs.
    function pairingProd4(
            G1Point memory a1, G2Point memory a2,
            G1Point memory b1, G2Point memory b2,
            G1Point memory c1, G2Point memory c2,
            G1Point memory d1, G2Point memory d2
    ) internal view returns (bool) {
        G1Point[] memory p1 = new G1Point[](4);
        G2Point[] memory p2 = new G2Point[](4);
        p1[0] = a1;
        p1[1] = b1;
        p1[2] = c1;
        p1[3] = d1;
        p2[0] = a2;
        p2[1] = b2;
        p2[2] = c2;
        p2[3] = d2;
        return pairing(p1, p2);
    }
}

contract Verifier {
    using Pairing for *;
    struct VerifyingKey {
        Pairing.G1Point alpha;
        Pairing.G2Point beta;
        Pairing.G2Point gamma;
        Pairing.G2Point delta;
        Pairing.G1Point[] gamma_abc;
    }
    struct Proof {
        Pairing.G1Point a;
        Pairing.G2Point b;
        Pairing.G1Point c;
    }
    function verifyingKey() pure internal returns (VerifyingKey memory vk) {
        vk.alpha = Pairing.G1Point(uint256(0x22f9b408f5f83400fba9eecfc5d7918c5542a1dce241465c8d0b39af2fd25248), uint256(0x30429470ab0d027fe0c665cb00b07b0473b843e4ce825be79236cad35e41ae28));
        vk.beta = Pairing.G2Point([uint256(0x22a056fcdec309e80acf94093eefd6724ba722f310a9daa67e1032cb419c6b1c), uint256(0x1d3613dbaa00347cc3d467eecb852a8c156aacf026247dec427f1a7bc752975d)], [uint256(0x24d035e71d4278c8ff0efb981aa797c7cc56ec314f4a38f5bce5b64fa6a31d32), uint256(0x2f6bce16e2d70a9cfdb69683bce8f3dc8022174a80d60ab3cc1d31e9129d9817)]);
        vk.gamma = Pairing.G2Point([uint256(0x0a1eb9315d96359d2c2fcf0a57638f542d91d2d5a12f38fef79e9e6770004950), uint256(0x233e01f66df1fd57669991af5a199cbcd912ebe46441d5f5fcb7e71ca48104f7)], [uint256(0x2601d5605e68268984fb6323cb836df7ef9964fb7fe8c54e88f5c65ff3ba6863), uint256(0x0177637ce461845599518635ada4b45f13055b3132dbbe474e385383ce94ec27)]);
        vk.delta = Pairing.G2Point([uint256(0x175ce9714ec6cae7572437512bb378b3d963338f9ae7e3e3f2412a1e6a14391d), uint256(0x1d6a8951158747bb5c7ddad00958766baa5f7a572a7f213e26636d6004de63a9)], [uint256(0x2ad4fa07ff804eaa0eaf602a5f3b6392c3354c1b502f19df5382b502bdd5f4b7), uint256(0x1510f89eeda3e65be9ef40afd8088783200d1e8d943df21cea516cd9084f01ea)]);
        vk.gamma_abc = new Pairing.G1Point[](25);
        vk.gamma_abc[0] = Pairing.G1Point(uint256(0x1766737912dfbfdad4b1df5872ad3ad73423392e19aa05523997f4fac23e2b06), uint256(0x024391721cddc651e9f5f31e3ae80f4c0ef235a93fa1fedded754fa3047d15c5));
        vk.gamma_abc[1] = Pairing.G1Point(uint256(0x2bdbf767084fee8e938348bfd38bbb992f85c9e7e99022ed83dd76bb367cbf01), uint256(0x1f9e37bf59ad97e5893edee324d6955aa4174cdc3b4db72b76e5c16dbc3044ab));
        vk.gamma_abc[2] = Pairing.G1Point(uint256(0x296900c7ad65e8b8789c473f449c38e6983e2fe6a608971dc2312405ab4d6e81), uint256(0x3031e14794b0f8ef15c4c871c17725b95959a90aacea1cd1dc0db4dc996e6889));
        vk.gamma_abc[3] = Pairing.G1Point(uint256(0x1d16e04a28e0801a3cf8482303f47a66c4e8acdb1da08a44a342d32759d19d18), uint256(0x27eee07c81960bca60d48dfe059c8b2bf4c88c58d3ca2c26109bfa5b85535d2f));
        vk.gamma_abc[4] = Pairing.G1Point(uint256(0x22824b52afb8322a0bbf3e89b3f4ffc3908027900597ef137e002c44c1cdd709), uint256(0x0bc0d403437410fa9c5481c7d7a6612b7203efc8c8ff3c0edacb9b7a73a1531b));
        vk.gamma_abc[5] = Pairing.G1Point(uint256(0x0c86016d4435b6e1ade18390a6383fbec78c5f7ca0b6eeef752faeb0ab064ace), uint256(0x055fdbb4c154f9696d43029d5993b9eaa3e4600bb56be12cea547fa8bca07869));
        vk.gamma_abc[6] = Pairing.G1Point(uint256(0x03dd78adb5767003dbdf1a30c2f209c1a9691810dc2357e4323f43b2a0329055), uint256(0x10b1819d07bf5c71ac3329827766dd45e53761019f864f4af2e3e0d03995738f));
        vk.gamma_abc[7] = Pairing.G1Point(uint256(0x031b7d6ef91780228d9e657dcbd920dccd186cb202e909c70bde30ab3b12fb79), uint256(0x1d4870695458ce381fae1cd1be7e6c2b9ff6daaa4061303bc0eb1baa2ee8a3b5));
        vk.gamma_abc[8] = Pairing.G1Point(uint256(0x1ed30eed2e236bd9cc23108c5ec20c0fbde749408fc5b9001604ff223644fa3a), uint256(0x070b6998755aff3253b3ce99cdecb41ed84da9b4ed7e6ba52221e86adce6ffed));
        vk.gamma_abc[9] = Pairing.G1Point(uint256(0x02e51f3c51eb35a07a42453bc6097816d76f5e201edb0b6ce746da68035c327d), uint256(0x0ab5501cd4cf68840726a721a1768ac99ef24af34661cd1ac65a9c8ae715d0f2));
        vk.gamma_abc[10] = Pairing.G1Point(uint256(0x17baa79f0e39d70d76d06a8513a35c927c3bf3ca8e30a8742896a42bc2acd329), uint256(0x015d9a66ad56e96a6f0afac38461f47ac2c661ab8b5837a779cdb3c34f1bb4be));
        vk.gamma_abc[11] = Pairing.G1Point(uint256(0x1495d9f21ffcd20c55424bf62aed3d278704f4403054bce910f6db728969fe79), uint256(0x15ba74007d9e368681809cd35e6c2b4d779fadce0571a3020df14c41114d48fe));
        vk.gamma_abc[12] = Pairing.G1Point(uint256(0x0186c71c6200ec10f5f5ae4888dd4ef22e08902e65412f97b43f446ad2a84b1d), uint256(0x24162e53b618d8805e6e9735921a7edaa20c9bce51162986ce46d48a94ab2ce8));
        vk.gamma_abc[13] = Pairing.G1Point(uint256(0x11b7662e62022acc579bd5e9fb7990b642c1c9189793953323ca17b676f4dce1), uint256(0x0987f2cbec32b7c68927309f01f8b45ea61e11958e30bdc74d80fabf5fb69d68));
        vk.gamma_abc[14] = Pairing.G1Point(uint256(0x05483ed27223f2c3b7ed28398f3e43f9905c5d03e6a43a3b9d7a5137200684d7), uint256(0x138462d99db4892b5d12f503d4a123be91b9437e056d80479035a70c1a6d89ba));
        vk.gamma_abc[15] = Pairing.G1Point(uint256(0x24b2c26e95848c16d88c13d24c771eb528d5042d450f3f778ea7d7a424bdc476), uint256(0x188fa715b6e1c27b51c2546954c4852d82e3938d50aa8e1426f548f60e8b0317));
        vk.gamma_abc[16] = Pairing.G1Point(uint256(0x2a39dfc5d6d1334873cd3b873ae3f0f8de1cf68781b10b77df7df2b12a7bdbe4), uint256(0x10cdf61afab5c77d322f3c9dfcc26846cbc31d89b54fbde3de6e30f2726ed604));
        vk.gamma_abc[17] = Pairing.G1Point(uint256(0x0caaec700b5f86bcd941149dbdbb9ebd69cb3576c26f83ab7154b1bcebc88690), uint256(0x2d88afff3e5759544fd330f2103eb949c262f099b399823a9ce05692508e9137));
        vk.gamma_abc[18] = Pairing.G1Point(uint256(0x282162f9019568b68da216d354352f5013ff238d0308dc2f8869feb9acb70519), uint256(0x1b43c154733f0efbf3bbad9f6c0f08105ca196ca0fd0b833e2fe358261c2567a));
        vk.gamma_abc[19] = Pairing.G1Point(uint256(0x19849d411310daa926103ebddfef040f6016178873df60e2f6ab509f073b3004), uint256(0x13235be64e9d1bd60ac7e8d43146f5b1063a1ac4efd1a817f8a2731ae5e22cdf));
        vk.gamma_abc[20] = Pairing.G1Point(uint256(0x09e813acaabddc2b56ca9189fd9a488abd696f43564653699a67bd0d5d4ee09b), uint256(0x1cc74e46b83dfb904a4b2ba924bd250f577427e5917f4ca5dda285e15952aea3));
        vk.gamma_abc[21] = Pairing.G1Point(uint256(0x0b3274ffef607502e681e580e16d49de7f2f2384808018572b7093b62f7d9a64), uint256(0x24fff6366ba62dc92a91bf4c6b89c89416a03bb5c94132421d684bb369f50a68));
        vk.gamma_abc[22] = Pairing.G1Point(uint256(0x23a6a8d386b688102b52a06f1dc766f12fb72f8074aac33287e3a58e88e4f56a), uint256(0x1426639cd63dcacfc615a57b491741e9365ab05b05bfc4b9ad08a68ea90d737b));
        vk.gamma_abc[23] = Pairing.G1Point(uint256(0x11d797a03f55588d375d3f5c25f0a851d5e480a43ba375a8f147723616b1e612), uint256(0x27c89a8eacedcfac0b87813044e0308abb753f779ff7b49da9d0406e5b93a6d0));
        vk.gamma_abc[24] = Pairing.G1Point(uint256(0x27178cbe534e7a98195b01d95c0b3933dc68e1b7842fc87867752d99b0908789), uint256(0x1b2b38a3a5b077108ab73f42070e71eaf2bf8c9d5d6948625791c4b2380282d8));
    }
    function verify(uint[] memory input, Proof memory proof) internal view returns (uint) {
        uint256 snark_scalar_field = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
        VerifyingKey memory vk = verifyingKey();
        require(input.length + 1 == vk.gamma_abc.length);
        // Compute the linear combination vk_x
        Pairing.G1Point memory vk_x = Pairing.G1Point(0, 0);
        for (uint i = 0; i < input.length; i++) {
            require(input[i] < snark_scalar_field);
            vk_x = Pairing.addition(vk_x, Pairing.scalar_mul(vk.gamma_abc[i + 1], input[i]));
        }
        vk_x = Pairing.addition(vk_x, vk.gamma_abc[0]);
        if(!Pairing.pairingProd4(
             proof.a, proof.b,
             Pairing.negate(vk_x), vk.gamma,
             Pairing.negate(proof.c), vk.delta,
             Pairing.negate(vk.alpha), vk.beta)) return 1;
        return 0;
    }
    function verifyTx(
            Proof memory proof, uint[24] memory input
        ) public view returns (bool r) {
        uint[] memory inputValues = new uint[](24);
        
        for(uint i = 0; i < input.length; i++){
            inputValues[i] = input[i];
        }
        if (verify(inputValues, proof) == 0) {
            return true;
        } else {
            return false;
        }
    }
}
