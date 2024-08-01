import { readFileSync, writeFileSync } from "fs";
import { ethers } from "hardhat";

interface IContractAddresses {
  idp: string | null,
  registry: string | null,
  verifier: string | null
}

async function main() {
  const NaiveIDP = await ethers.getContractFactory("NaiveIDP");
  const ZKIDP = await ethers.getContractFactory("ZKIDP");
  const PSSIDP = await ethers.getContractFactory("PSSIDP");

  // rt depth = 8
  // ~ 2^8 = 256 identities per hour can be added to the IDP's merkle tree
  // validity = 604800 ~ 1 week
  // 5400 ~ 90min
  const idp_naive = await NaiveIDP.deploy(18000, "http://localhost:65535");
  const idp_zk = await ZKIDP.deploy(18000, "http://localhost:65530", 3);
  const idp_pss = await PSSIDP.deploy("http://localhost:65525");

  //await idp_naive.deployed();
  console.log(`IDP deployed to ${await idp_naive.getAddress()}`);

  //await idp_zk.deployed();
  console.log(`IDP ZK deployed to ${await idp_zk.getAddress()}`);

  //await idp_pss.deployed();
  console.log(`IDP PSS deployed to ${await idp_pss.getAddress()}`);

  const ZKVerifier = await ethers.getContractFactory("Verifier");
  const verifier_zk = await ZKVerifier.deploy();
  //await verifier_zk.deployed();
  console.log(`ZK Verifier deployed to ${await verifier_zk.getAddress()}`);

  const Registry = await ethers.getContractFactory("Registry");

  let pss_addr: IContractAddresses = { idp: await idp_pss.getAddress(), registry: null, verifier: null };
  try {
    const pss_key = JSON.parse(readFileSync("../pss/secp256k1key.json").toString());
    const PSSVerifier = await ethers.getContractFactory("PssSecp256k1");
    const gmpk_struct = {
      pk_m_x: `0x${pss_key.pk_m_x}`,
      pk_m_y: `0x${pss_key.pk_m_y}`,
      pk_icc_x: `0x${pss_key.pk_icc_x}`,
      pk_icc_y: `0x${pss_key.pk_icc_y}`
    }
    const pk_sector_x = `0x${pss_key.sectors[0].pk_sector_x}`;
    const pk_sector_y = `0x${pss_key.sectors[0].pk_sector_y}`;
    console.log("Verifier keys:", "gpmk", gmpk_struct, "pk_sector_x", pk_sector_x, "pk_sector_y", pk_sector_y, "pk_sector_x_test", BigInt(pk_sector_x));
    const verifier_pss = await PSSVerifier.deploy(gmpk_struct, pk_sector_x, pk_sector_y);
    //await verifier_pss.deployed();
    console.log(`PSS Verifier deployed to ${await verifier_pss.getAddress()}`);

    const reg_pss = await Registry.deploy(
      ethers.zeroPadBytes(ethers.toUtf8Bytes("PSS Registry"), 32),
      await idp_pss.getAddress(),
      await verifier_pss.getAddress(),
      2
    );
    //await reg_pss.deployed();
    console.log(`Registry PSS deployed to ${await reg_pss.getAddress()}`);

    pss_addr.verifier = await verifier_pss.getAddress();
    pss_addr.registry = await reg_pss.getAddress();
  } catch (e) {
    console.trace("Could not deploy PSS Verifier", e);
    await new Promise((resolve, reject) => setTimeout(() => resolve(undefined), 5000));
  }

  const reg_naive = await Registry.deploy(
    ethers.zeroPadBytes(ethers.toUtf8Bytes("Naive Registry"), 32),
    await idp_naive.getAddress(),
    "0x0000000000000000000000000000000000000000",
    0
  );
  //await reg_naive.deployed();
  console.log(`Naive Registry deployed to ${await reg_naive.getAddress()}`);

  const reg_zk = await Registry.deploy(
    ethers.zeroPadBytes(ethers.toUtf8Bytes("ZK Registry"), 32),
    await idp_zk.getAddress(),
    await verifier_zk.getAddress(),
    1
  );
  //await reg_zk.deployed();
  console.log(`Registry ZK deployed to ${await reg_zk.getAddress()}`);

  const addresses = {
    naive: {
      idp: await idp_naive.getAddress(),
      registry: await reg_naive.getAddress(),
      verifier: null
    },
    zk: {
      idp: await idp_zk.getAddress(),
      registry: await reg_zk.getAddress(),
      verifier: await verifier_zk.getAddress()
    },
    pss: pss_addr
  };
  writeFileSync("scaddr.json", JSON.stringify(addresses));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
