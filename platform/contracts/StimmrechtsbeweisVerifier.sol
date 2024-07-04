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
        vk.alpha = Pairing.G1Point(uint256(0x052cd1f7d130309557368067987c7e739bb0dd92d625abe870a7ec527aff15ed), uint256(0x1a5d5a58db4cd94f47fe3e85ea42ccb37647dfd7d4745c45be549db53414f5c6));
        vk.beta = Pairing.G2Point([uint256(0x01f729239c5dfad7b300e39a9d99d0e629ede8ba3209911c3a32f21db064a30c), uint256(0x1d7d00bb9c156980e79aaa4d7b5efc230c29d934dcdc4efd8ec6a77b97e6013d)], [uint256(0x07500a576194774cd4516bd4f8e0f0a338730db500f310e6f52f4566036df5c0), uint256(0x01986d31307d990053f74bca3c416a4986b2dfe76ec588338a8a7e9c934fbde2)]);
        vk.gamma = Pairing.G2Point([uint256(0x15bd96d5a68e97c4f9b8ec6a47733b0788ed8fb2e4180418bf15d747ab3f8685), uint256(0x29dca9003feb33e3dfe3102080512d8b0bfece9873e5bee7ab000ca1807c73f1)], [uint256(0x22bc655a61b36c756538c42f07477e4a44d7fadc24f21f67b4b2e488f3a53067), uint256(0x0ce58f712732901e5659e00275b68d53d199ba79fce834fb71b15f9b71324d98)]);
        vk.delta = Pairing.G2Point([uint256(0x189efce142dc7364c4d5d0337dadc841fb4a12c4fdcf8ac3f290b6776b9517dd), uint256(0x23c66e6a177065f4b8558bb09de56aeff9ee2c5ea6cbeab9c1550b36cd6057f8)], [uint256(0x15dab0e2f56d49b9d62fb8c17ecc309ef59932f39c17a6f86222cc2bf3ccf4ee), uint256(0x010cf23a796cb1431764a2270ebe6264abb3de9976f91662daf74dd2d3412e52)]);
        vk.gamma_abc = new Pairing.G1Point[](25);
        vk.gamma_abc[0] = Pairing.G1Point(uint256(0x1878ff379e0a569aedfb71315c2b7e61f750b1176b107a3eb8af4d2558a418e7), uint256(0x2d74142761e51e77a970e7621a1aa191fb5dc20017f86f65945a6e49147e8de2));
        vk.gamma_abc[1] = Pairing.G1Point(uint256(0x1a2e3367dda4ede6886a819a0f54811a8ed04894a67c87e624667863283c1a12), uint256(0x00b16a432ec576a24adac73b4dc20cc1f3533e36017199d038ecf8e6e9b70a58));
        vk.gamma_abc[2] = Pairing.G1Point(uint256(0x16129660dc0f905d93dc6aebc3a29036e2820fc953145ba59c3e4124720a7138), uint256(0x269b55b586dd3dfa0e34d7c8d9a306c54f884e8236fd16945db5fb9eebaefe59));
        vk.gamma_abc[3] = Pairing.G1Point(uint256(0x2e73543e6cfad44cb12b77a96ea05e0343411a5c44d03b94cfa14b1e6a5f51a7), uint256(0x2092ec67b2161707ae65879c2c0763e470f4c2a7fec119e46675a16e984c78e7));
        vk.gamma_abc[4] = Pairing.G1Point(uint256(0x16301988d2dd2d1e5b9698bc0081faa1a8f4628f691decbb3a3ee62b9857aceb), uint256(0x0c8d207919823c3829e7393c49d60e9044b80b45d11725ad3037654953ee6bc1));
        vk.gamma_abc[5] = Pairing.G1Point(uint256(0x0f8d9d46763d1ca89dbaa6242608bd25ad2670770c1ec17544a45ecc3c0d22e7), uint256(0x0669fe67b7e057dab780f39c2eef8ddb96aced44264014f609aa6769ac96d58d));
        vk.gamma_abc[6] = Pairing.G1Point(uint256(0x10cb4a1162a04bd97d545a9c2f399a7cb8e330db688f2fad5905f8e5beba9cda), uint256(0x000adbb1988cc30deea33c04c3252521445cd63360b135c97c2553ea27e2342f));
        vk.gamma_abc[7] = Pairing.G1Point(uint256(0x2938cdad6498a2090ba58b4cd40725dbe38a81130c0300cdb09b45c9e16ccd7c), uint256(0x18318e97c96c95a786d144fc75a11b248b695f34325b25e320ae463da98ad387));
        vk.gamma_abc[8] = Pairing.G1Point(uint256(0x1ae55daf32961a70ef56d7a4d9780872d763c3ca8cea713febeed22fba1af00e), uint256(0x0fdd3aad8c87a6eecb5b592fec15fa6b3baebc1e4037811a96e3b77ee8769d99));
        vk.gamma_abc[9] = Pairing.G1Point(uint256(0x056ed40434518deacb176cf59902ba187c69304e17a3bc649fcb6755f780f9cb), uint256(0x155ad03b005be0f586511cdd06b85de28c110ba8a7f0c87d5e4ae42eecc0f684));
        vk.gamma_abc[10] = Pairing.G1Point(uint256(0x1227d403a2271d24922dee5239081204250ee01945887bd549a1f46725e65acf), uint256(0x3021ca3e338dfd3ac5f63246c38b293f85cabbeebbdf61389928c775d2aaa0d8));
        vk.gamma_abc[11] = Pairing.G1Point(uint256(0x18e8fa6410b6ea736b1ffcf1a0c2d4bf4bcc32c93ee60561978ae3fbf51fa042), uint256(0x0e7c3b4818796bb348d7516e67e50fd8eff072c141eff112235d7adad18ffbf2));
        vk.gamma_abc[12] = Pairing.G1Point(uint256(0x1a64378f794f2c0dd6f9bca164260fa23ae6346b841284ea02cad58d346ea31c), uint256(0x172d20494eee41dc8bff1a1fed81862dcb88b52b977c1e26de98640309d9b8a7));
        vk.gamma_abc[13] = Pairing.G1Point(uint256(0x1f19589e9a99ba4a2bfa89112d5a04d4c8096c2344d0547ae24543b138f4963e), uint256(0x07fd7aead346fb47b65233cd69afdcb82f44f6cdf56e525ea25ff896d671a364));
        vk.gamma_abc[14] = Pairing.G1Point(uint256(0x05307a4e6d431a3e7a493d5fb901be8edd34c7b1ad144a2e592268835f4283d1), uint256(0x2a258af0512b9a1afc27e3e7d0229248f660fb3e6cf9e5873194605c87ac2674));
        vk.gamma_abc[15] = Pairing.G1Point(uint256(0x105090a1560028ffe04922c271d22735e96835574859389ae25075ddca938a9b), uint256(0x238be364818e52c9a3be038afff2b28421d38703b328482e7e6b5df4711c86ce));
        vk.gamma_abc[16] = Pairing.G1Point(uint256(0x204967892afa0b599525247fc3838e4f6b5d94932d648ce2dadca946b7b4aa99), uint256(0x2de8bcefeb4ef1188e52673ce17c26c49eed77a2d3a334fded6c477e693e05be));
        vk.gamma_abc[17] = Pairing.G1Point(uint256(0x1682c2891c3e3a08fbb343e5d100b2e43050ea9b73e6ab49716b5c39cc0cb85f), uint256(0x2ea61a3c4255cb3501654497d221ac552fd83e0ce0eb358b9507cf42a302fa8b));
        vk.gamma_abc[18] = Pairing.G1Point(uint256(0x2ffbc5e488d19ba8de51928f8cd87aa93949880f0218e91189dcda9d109ddfab), uint256(0x22b887cf93125672323a1b579a9093a825c5d0d3eedb7bb911d1672ec030c2b4));
        vk.gamma_abc[19] = Pairing.G1Point(uint256(0x029bba721e5266c8baa59a354c1f81357d1a37197b9ddd4b676353c621317a08), uint256(0x29414996500f93bec0eb93e704941a3be66f96448312bba1a8b85b90654c649f));
        vk.gamma_abc[20] = Pairing.G1Point(uint256(0x15815cba2b4676a8b58a0efd91e596ca4f3e94bf70f7275725ea97613e5902a8), uint256(0x04b3fbd63bbede45a2cb10d19e53a4c65e90bc440e7f8a151d686520246f6fc1));
        vk.gamma_abc[21] = Pairing.G1Point(uint256(0x2d439bc21b6950f521f4aea9e51a4f1e1d2b981a227bbc6535b7bef381492dca), uint256(0x05c64f77369e426d25b5de9b138db8d623d320fde44d9f75a5fc0f6e5af85e99));
        vk.gamma_abc[22] = Pairing.G1Point(uint256(0x05f93b0d51dc44464f57abe2c4dbfd6a0fb07b3e961375f8feb54ba387554c4a), uint256(0x02c08e6097c05fe63703634a3aa76c23e994fae7e6eb17143defe2ed2497f672));
        vk.gamma_abc[23] = Pairing.G1Point(uint256(0x218219dd599414dbde356fb577a5c04386fc426a5aa10f61c41ab217fedbbed4), uint256(0x236a4fd1a9acb2f0401ea21ccb16b610498819220ed8638b1b75d83c32dcec34));
        vk.gamma_abc[24] = Pairing.G1Point(uint256(0x048cb9e5e6776f055fa5874d56955fe80aaa5b1e0a38c44663924390abe71cf3), uint256(0x1b75538c1314e7e90ad1f8a9029851c2ca3adeff292023948bd53509f20aeade));
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
