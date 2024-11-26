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
            success := staticcall(sub(gas(), 2000), 6, input, 0x80, r, 0x40)
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
            success := staticcall(sub(gas(), 2000), 7, input, 0x60, r, 0x40)
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
        vk.alpha = Pairing.G1Point(uint256(0x0b9b0cbd06fa76977fdc2cdf63c31ec45c88ed077a68e790e78f6e34bd258d44), uint256(0x2d5b551b51dbac3934d2c50a27f366f331f5065569ae956bdf41f78660b8e8f4));
        vk.beta = Pairing.G2Point([uint256(0x01c4ea64ac403f03bcb18f18e1c7b30d14f30d23cb29010bb3c317160a823343), uint256(0x2491099fa863e14fb985f222c453da7e45ed84ad17ae25a3e75b262b6341d37e)], [uint256(0x265134e2dea6c0295ba23d9457b3d279d05b8715922ef2e6b1f221ed09bd4246), uint256(0x12e9cc5aec924f0e0ca6a9ad2c192a3cc6f160ab655d444bc4299483c16ae35f)]);
        vk.gamma = Pairing.G2Point([uint256(0x1c463c530aa488347d87e813e046f1e69840a2accead307491d7b94956a8b38e), uint256(0x03e1dc49a2340b0b38090c128ba034f6ea0ef4eaaefea54d806db63b95778285)], [uint256(0x003c4277cc04b28d2f81f106500fb62bb68c4cf158a843ba8e8dd173a8cd8d97), uint256(0x032e76c0566eab24ce2dfba05407d5c779daaeaf94fe5b14c9d6727eb8a8e386)]);
        vk.delta = Pairing.G2Point([uint256(0x187203c70d34eee68866939636dc012d779445c056a4f2f06ac741be82a48240), uint256(0x2524533243cad2ef32debd5e9acc5bfac6d3f4cc3660e235a7d78025d1d59a32)], [uint256(0x048f517e2675afd765c3f7c9e31c1312bee56464de55d9a49329a46a72424873), uint256(0x1b9548bfb75c4f7dba767464af96b969bd1d118eefe55483b1dfdf5d6c1dc2f4)]);
        vk.gamma_abc = new Pairing.G1Point[](25);
        vk.gamma_abc[0] = Pairing.G1Point(uint256(0x2b4a06f4e30498af7ac7643e2ac7c040924781272ada2eb36ba0e47b019eef3e), uint256(0x216b08d67b8d5efdac52c8fe81e0499de626df74b377ee679b1a2a22740e0acb));
        vk.gamma_abc[1] = Pairing.G1Point(uint256(0x1489ef7010ac0667921debd16092158207fb6cbe98154f1cafe059b46ac53025), uint256(0x0ba5569e34b55e63bbad9a3ec753181d909a1e9b0e5cc1db53c37f48fe55e5a9));
        vk.gamma_abc[2] = Pairing.G1Point(uint256(0x025b8f214d0dd40a133331f74fe60b38731721b24873e0f8ed930d64c1bdb7d6), uint256(0x2d356b9ffbf278ddc57cd05f5dcbe9a1338972c43cd015dbee1b6975891788de));
        vk.gamma_abc[3] = Pairing.G1Point(uint256(0x0734826ad4d91ca9d613a1992b4ba5c1ff08fa5d1f6b682e56e84779ad3dd11f), uint256(0x18de418c217105573fcd422fe63a4472622a3a3da171c168fe5724856beb505e));
        vk.gamma_abc[4] = Pairing.G1Point(uint256(0x12bb8abc36308ab17732962a06ec65797e7a14589c567b59fceacfa602a6d965), uint256(0x12ece989198dd9a0455a98a87338e7f1975cd6bf9b7a1a2f4da75d8bc8475965));
        vk.gamma_abc[5] = Pairing.G1Point(uint256(0x2d2f2290c57f5a048a135da770de8e3f47e282c388c4f5339b9bf8e250c2fa1d), uint256(0x1466ff03306722dc85f97e1bb005fa333f7999055e64d737cbd614d2261f66a8));
        vk.gamma_abc[6] = Pairing.G1Point(uint256(0x26da343e449bcbee0b186097a48cbf6d402ed299d13052db801dc0aa9a592f2b), uint256(0x0c4c69f35927ba0559db1403d7dab642f6a00df191104499ea4df71f40b5fdf1));
        vk.gamma_abc[7] = Pairing.G1Point(uint256(0x1fa5b8da90fb267b5824bd990242bd971dfba507f42f19ff46b6d0ada7e97346), uint256(0x1c4165d301329f98c209b94e0fec94d6527710d76f2677a0e6a6046331a1f0a7));
        vk.gamma_abc[8] = Pairing.G1Point(uint256(0x1c6169eacee1e17a9f9530265395cbd4319d91ba22f0f7a1f2f4d05a3ca409f2), uint256(0x08663839a702ad417e5f28168867b55484d9508fd5b7cd9b65a46936e72fbd82));
        vk.gamma_abc[9] = Pairing.G1Point(uint256(0x0346a49016b8ab0b6e5a2e8124bebe559251ddef80005255e392256fab64a82f), uint256(0x3051e0e2d7e29ae145c94413ae89546ab9484ff1b02d2d588e73f522fded35c1));
        vk.gamma_abc[10] = Pairing.G1Point(uint256(0x204e1b498561e850231d4566d67c69e6e3116680993d7054dab3dc590c2a206b), uint256(0x10fa53b72806dabe1bc92afbf8a51c8c51f87a5bac320ef3d8f2195c4fd7b65d));
        vk.gamma_abc[11] = Pairing.G1Point(uint256(0x1baa9f36c9b31bfee1d9e4490d7e4e32c30a520f9745f8341b31033f9366613d), uint256(0x222daa6f0a08a8a5a83fbdb5b44d20053c8aff3598af457a91524fa4e1f217b4));
        vk.gamma_abc[12] = Pairing.G1Point(uint256(0x1efaef14e876256ccaa18ba00b78760036e268c83c6820f292935e032ec676db), uint256(0x05a838de2d52896438f2b91358c8ef608c0ea1324ce89321b0aaf66baf8ab859));
        vk.gamma_abc[13] = Pairing.G1Point(uint256(0x28935cffd81c6a38b4f6c8ffc6a0de9be532b76748ab663246625043febddb32), uint256(0x0e3b2596c19c9550f4c401fcb7115daebd7b807120763e611f2b872f88be2afe));
        vk.gamma_abc[14] = Pairing.G1Point(uint256(0x069bca3e3a7a01a88c7c8becb90eccd6ddebb8d6156fb5da6a9b0e085e773a17), uint256(0x28813123d03a339ff291bfdd0313c5525f87772813bb61dcd1e89f86e7d636f0));
        vk.gamma_abc[15] = Pairing.G1Point(uint256(0x02477e6a186b0886bbd4076404d323ba6671879cf7833231609dd6adb4add861), uint256(0x255066df73a1ba4a5b7cf8b5ff322849a61c9842c0643f7f5f9d6aafac3e0ddf));
        vk.gamma_abc[16] = Pairing.G1Point(uint256(0x1784eb1730e0592cac7660eb80d83282e9d27dd4b0ce3a2028e3eaf7894f009a), uint256(0x1d64d44fbf4c4c415c14b8ff51adc07e938bd035ed38ef4173b038bdc3b0c102));
        vk.gamma_abc[17] = Pairing.G1Point(uint256(0x04487af2ae211ed58398fdea24f0279666d40527cad30797654d5391249f6c74), uint256(0x03465c464ff72545bbc428fe1f67dae5a9793d0723abdd4170256e7225e58986));
        vk.gamma_abc[18] = Pairing.G1Point(uint256(0x157a8a3ade09c92a4423299df55e249f770c6a2bd9e1afa867f59f19c406c774), uint256(0x0505323bf11730478ef2304f766ed8bccfb7f42db54d1ef23db1f67f6efde556));
        vk.gamma_abc[19] = Pairing.G1Point(uint256(0x1fa64c1726df4907513313e37d33d0f69f1389db0f008732e4d6d1ec2293a66e), uint256(0x2be0d8cd71f70044bac0a03bbf65e5835620d126e46b706c3cab6c81ba68151e));
        vk.gamma_abc[20] = Pairing.G1Point(uint256(0x2f6d0718bce3e2c3ec45764679ab7261b80e44ca9ce98ee7cdab8af08b312256), uint256(0x2cb4a9dd8e995151975a0ddf0c2c214fb3fd2ef72cf6378587af30621b34ab74));
        vk.gamma_abc[21] = Pairing.G1Point(uint256(0x10959f265422e7d8a599009de2d070de1177b1ae63fcd9e34a231b54ba1ae7bb), uint256(0x1dfa2d5c70656d8feb9e27c60b0778ff20b882105e435b14e0866a62c6d361ef));
        vk.gamma_abc[22] = Pairing.G1Point(uint256(0x05a98a8fd50431d22a6aef71c19a7566d7ad60559612c20b54f2c717b8729ec6), uint256(0x096de408d7c52a71aa48efa5d75e0bb0cdbf4feb3f7c3e887a7ad8fcf500ccc5));
        vk.gamma_abc[23] = Pairing.G1Point(uint256(0x2a2dc3ce9f6687e5f92d6f667565130c231482ba781921f9d953f10ca2940ac1), uint256(0x23d8cdfe5f2191c3cb7a73467be140443c4c8a0d20eb1deef9a1c03639ef9bfa));
        vk.gamma_abc[24] = Pairing.G1Point(uint256(0x13811fbd1d6465ff1455736501eeaa41db31276d82548eaa0390c0e9246a6021), uint256(0x0c31737fb41a84816e46a353bc8abde0d24a0aeea81dc6f38effbf3469c29b06));
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
