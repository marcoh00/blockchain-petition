import { readFileSync } from "fs";
import { ethers } from "hardhat";

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

  await idp_naive.deployed();
  console.log(`IDP deployed to ${idp_naive.address}`);

  await idp_zk.deployed();
  console.log(`IDP ZK deployed to ${idp_zk.address}`);

  await idp_pss.deployed();
  console.log(`IDP PSS deployed to ${idp_pss.address}`);

  const ZKVerifier = await ethers.getContractFactory("Verifier");
  const verifier_zk = await ZKVerifier.deploy();
  await verifier_zk.deployed();
  console.log(`ZK Verifier deployed to ${verifier_zk.address}`);

  const Registry = await ethers.getContractFactory("Registry");

  try {
    const pss_key = JSON.parse(readFileSync("../pss/secp256k1key.json").toString());
    const PSSVerifier = await ethers.getContractFactory("VerifierPssSecp256k1");
    const verifier_pss = await PSSVerifier.deploy();
    await verifier_pss.deployed();
    console.log(`PSS Verifier deployed to ${verifier_pss.address}`);

    const reg_pss = await Registry.deploy(
      ethers.utils.zeroPad(ethers.utils.toUtf8Bytes("PSS Registry"), 32),
      idp_pss.address,
      verifier_pss.address,
      1
    );
    await reg_pss.deployed();
    console.log(`Registry PSS deployed to ${reg_pss.address}`);
  } catch (e) {
    console.trace("Could not deploy PSS Verifier", e);
    await new Promise((resolve, reject) => setTimeout(() => resolve(undefined), 5000));
  }

  const reg_naive = await Registry.deploy(
    ethers.utils.zeroPad(ethers.utils.toUtf8Bytes("Naive Registry"), 32),
    idp_naive.address,
    "0x0000000000000000000000000000000000000000",
    0
  );
  await reg_naive.deployed();
  console.log(`Naive Registry deployed to ${reg_naive.address}`);

  const reg_zk = await Registry.deploy(
    ethers.utils.zeroPad(ethers.utils.toUtf8Bytes("ZK Registry"), 32),
    idp_zk.address,
    verifier_zk.address,
    1
  );
  await reg_zk.deployed();
  console.log(`Registry ZK deployed to ${reg_zk.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
