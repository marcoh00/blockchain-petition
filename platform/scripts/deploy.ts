import { ethers } from "hardhat";

async function main() {
  const NaiveIDP = await ethers.getContractFactory("NaiveIDP");
  const ZKIDP = await ethers.getContractFactory("ZKIDP");
  // rt depth = 8
  // ~ 2^8 = 256 identities per hour can be added to the IDP's merkle tree
  // validity = 604800 ~ 1 week
  // 5400 ~ 90min
  const idp_naive = await NaiveIDP.deploy(18000, "http://localhost:65535");
  const idp_zk = await ZKIDP.deploy(18000, "http://localhost:65530", 3);

  await idp_naive.deployed();
  console.log(`IDP deployed to ${idp_naive.address}`);

  await idp_zk.deployed();
  console.log(`IDP ZK deployed to ${idp_zk.address}`);

  const Verifier = await ethers.getContractFactory("Verifier");
  const verifier = await Verifier.deploy();
  await verifier.deployed();

  console.log(`Verifier deployed to ${verifier.address}`);

  const Registry = await ethers.getContractFactory("Registry");
  const reg_naive = await Registry.deploy(ethers.utils.zeroPad(ethers.utils.toUtf8Bytes("Naive Registry"), 32)
  , idp_naive.address, "0x0000000000000000000000000000000000000000", 0);
  await reg_naive.deployed();
  console.log(`Naive Registry deployed to ${reg_naive.address}`);

  const reg_zk = await Registry.deploy(ethers.utils.zeroPad(ethers.utils.toUtf8Bytes("ZK Registry"), 32)
  , idp_zk.address, verifier.address, 1);
  await reg_zk.deployed();
  console.log(`Registry ZK deployed to ${reg_zk.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
