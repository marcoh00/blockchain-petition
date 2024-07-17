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
        vk.alpha = Pairing.G1Point(uint256(0x2bb6543987963b646d5d2a911c832a417003a77e8e1cbf6065ea6a65b165b708), uint256(0x1a128820aa746b0847841be0916a7a65661915cf2030f61cb2a6ee77b006cef0));
        vk.beta = Pairing.G2Point([uint256(0x0108a635f12783fb0af02b793e4b7cc6c6f7ee180acc94e5195a2f373153a984), uint256(0x18e66a3286f682bfde2675c4d509cfc7219d4bc54a3a22b674a1714b46adf34e)], [uint256(0x0f59baee2422d3615082e4f1f4b2f624ec45c97f43c58b9df3623df343d92c7b), uint256(0x0715859801a0b679b156454a9f11bd48bb3d94ff2db8724d096e2cb467d1aa38)]);
        vk.gamma = Pairing.G2Point([uint256(0x224d3a973e8874564b001189bf6a9c6a85f3a63ed2605441a6439d9573452244), uint256(0x2772259fb2ebc95a23ace519ea5582e9b6420bc156ad0b44fee5718a593be1d9)], [uint256(0x0fe89345d5d5f1109ecb59f49323674ae5fc9caf6ac8a44e2bcfcbdad7c0c79f), uint256(0x10059d7202c06a6755424cbc2497c6de78528332b7f65176538852a2eabb74d7)]);
        vk.delta = Pairing.G2Point([uint256(0x2f99048c8f595f5ff78c013acd3bdddb37218bfdadf38c009132d9eeca17871b), uint256(0x086578421ff7246f8b50e7521109cfc6c641390a9f7fd9b1bdf0eb322a864c76)], [uint256(0x163bf07e6b9a40d59aba284980867d2066f0379c3fc16cab79b36a790a812452), uint256(0x0376d35fea5329119b50f9272e03671f73dc75911617514830d28d51a07c62f1)]);
        vk.gamma_abc = new Pairing.G1Point[](25);
        vk.gamma_abc[0] = Pairing.G1Point(uint256(0x179ecdf093689e560b4d389b4e52fc51b235bdb6ffc56d48ec2f1ee85e73ba09), uint256(0x18fe50db9926bba719f4ea4242278bb0a7db1c39a1b6a352f5f705736958dd83));
        vk.gamma_abc[1] = Pairing.G1Point(uint256(0x1adfe89dc4291dcd74bb1e25be271516d2840f4b6a3f3e474c87a4126c422782), uint256(0x1f5ed07ba506bd23930ccb86e5214a22c5fc789ce6d5db9ca8f52975b2b48e25));
        vk.gamma_abc[2] = Pairing.G1Point(uint256(0x25a104faf94ba8a1ff9baa01b34bafe325445bf8595aecfe857b7834c7cac7a4), uint256(0x2fbb3db7062ba4769c49df318206a47003a15024e1142dda01bc52457d499bf2));
        vk.gamma_abc[3] = Pairing.G1Point(uint256(0x15d8a289fce02884649c069188cff53eed42acb227561d87bf0fd0d272b7237c), uint256(0x25da6edf5c262d4a7bf51e2ec12ab9ed1e005216d6c19e8fbabd725c7370c4b0));
        vk.gamma_abc[4] = Pairing.G1Point(uint256(0x300f1c9a3ecc18e57f13f3db3c65c89358c009f6736e2ef142446609ab0fbf04), uint256(0x286b0ce9b3dc36f51dcae4fa156b7a0b862033b8c90535aa854c99f184097f28));
        vk.gamma_abc[5] = Pairing.G1Point(uint256(0x29835433ef06db4872d9d1e11d1ef81cfccd38d3a8a21d367802791000908b88), uint256(0x0b1f53948eb9925fdf509223b9e9ac7b4c609f721fb68f974110d1d2f897958a));
        vk.gamma_abc[6] = Pairing.G1Point(uint256(0x2c8d803aec8f3cc591dde329d2ca43e8a62275141cf087c279fd380706ae2d95), uint256(0x295616d57d8ebdbac34ecb77a4934b2aa8da5da427af819d46dbce583671c1e2));
        vk.gamma_abc[7] = Pairing.G1Point(uint256(0x16950f41ce8241cc9850eacb97482e0ccce069380bccb5782539f1ae1f5182a3), uint256(0x1e3ddb3dc765ea971ad4ca2145bb0cc5eeb2e9f6da81e407986b2fd8c58b6a0e));
        vk.gamma_abc[8] = Pairing.G1Point(uint256(0x16e33e2d287ea803ca3fd873966189241849fd948a4223a5f2aaffc9435cb947), uint256(0x007e62450f2e2cdbd11769382b6c58849b5ef6bcbdbc462b0ae1377dee84e3ef));
        vk.gamma_abc[9] = Pairing.G1Point(uint256(0x2207eca3ef12ef82f9c6d10a8dd80e22ed4bbd549b381bbd5f81a57919b31595), uint256(0x1f7fcc35b82e2250a9f2ebf4867248cd8e92028091181fc7f495da7a687e725a));
        vk.gamma_abc[10] = Pairing.G1Point(uint256(0x161d2efa5fda3d4078553833628a0493c35272a94575a7a3b6d613fee778d882), uint256(0x263aa3133c4962ec32c57360f5671f5043538bedd4e24aea8098370d98c85727));
        vk.gamma_abc[11] = Pairing.G1Point(uint256(0x06d07ecd9d26f6e95d944f9351e3f31b063676acb379ad0ca170ac897346294c), uint256(0x0cb1ca097142cf2c8a05fd727abd7c702c963df9b2773d58d40bb826826e885b));
        vk.gamma_abc[12] = Pairing.G1Point(uint256(0x278f3f3cb89ec8c225208dd4ac89787401ba691ed9df01dd2c7e0d1ff261c46e), uint256(0x227d21d74d817c1b7871260bcfdd8e3d1da4fcad122010f1acf9cabefac2536a));
        vk.gamma_abc[13] = Pairing.G1Point(uint256(0x1e220f109f80989d1646e1ca61fd0260ff00ab77518074271c22aad03010605b), uint256(0x304ccf6af5f53504c567e14409154cae0c5453e4880d3df1f058b3e7b148f925));
        vk.gamma_abc[14] = Pairing.G1Point(uint256(0x2482cb8d9533d7949ab99c3070ba3a998155fa4c976dfcd11c5cc9207dd003ec), uint256(0x1e81bc3085d05b1ea01adddd089fde13b031b1d6823286f460ee19061ed4ee0a));
        vk.gamma_abc[15] = Pairing.G1Point(uint256(0x2f1baa69e57428cff19d566d4ebd8a108a4f8ad831a4f77d7d449c89791520c1), uint256(0x2ab166c86409c7e2d0eb532db048206ddd667fab2247d53b27976c0e001c09bd));
        vk.gamma_abc[16] = Pairing.G1Point(uint256(0x26deb08f2bbef696967925f150eaedc1518eb60b2cdf86cb994b95a153ef3980), uint256(0x1e15e48fee4ec7bd413d1f1ee796c5fa28d920bbe0067d3bf1b21c0b497cc32c));
        vk.gamma_abc[17] = Pairing.G1Point(uint256(0x0b38bbf337bc93c441df26ae220ddc1302eddc8eded0f604619ba0712d4dbad5), uint256(0x15327904ee536c31c175372d160de7eb42b102a3a9acc64975cff7454f2281eb));
        vk.gamma_abc[18] = Pairing.G1Point(uint256(0x0a2a61e706fd194c3762410afc13a977bc8ed2e0be7ddbcdcc63a26eb2883cea), uint256(0x2a2e30a62eab6d2c2bc0801ae611033ae93c2c0a367b5ca9a3a8294593ab7e90));
        vk.gamma_abc[19] = Pairing.G1Point(uint256(0x0a9c26aaea11279d7d92d4050e851ace036b4ed542ec5a9163b13730ffae54f8), uint256(0x1b578a88f268d0a7e8721f2a807df02b61929ce810313fccdb4b60c982497ced));
        vk.gamma_abc[20] = Pairing.G1Point(uint256(0x134f3bf77195eb732a78a54c86203120b8eb3e47067ee25ec1120d85e3f473a1), uint256(0x1f92cb68f56515fcb2055778afd445f2692dc83ed35819d1e8ca538e30f33853));
        vk.gamma_abc[21] = Pairing.G1Point(uint256(0x00785b4d74fd77f45b661b22cf0256dc83a35e470c260655180fcbfb0ef40993), uint256(0x269fb77bc03d0cfdc9f4473aea38bda174cb6b025b750392c2239ffaeb0e2429));
        vk.gamma_abc[22] = Pairing.G1Point(uint256(0x05db641be4faad7404937db14e7cd7fbe41c56ae99074cff2af337a82b23a85a), uint256(0x247384f38e4c25c1f174e4986bc1ca8bdc94d858dfb1d6ad14238bf39cb86614));
        vk.gamma_abc[23] = Pairing.G1Point(uint256(0x1690e18cd7b2790441c06b9308b3387709863b5a64cb6fd389aee15967a6074f), uint256(0x0d65ccc3e88c134df0242c8fab9dc6d9a340a7531acb9574835e30a6d79f2cd9));
        vk.gamma_abc[24] = Pairing.G1Point(uint256(0x181073a561d1f1af43a3f21205637d47eff3839705754819fdd07fff8d83e9fa), uint256(0x065119cea3b060e7903bf9b4900b5051e18f3f94a5bbd009c3fdfcfdef23608d));
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
