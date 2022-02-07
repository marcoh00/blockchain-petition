import { ethers } from "hardhat";

async function main() {
  const IDP = await ethers.getContractFactory("IDP");
  // rt depth = 8
  // ~ 2^8 = 256 identities per hour can be added to the IDP's merkle tree
  const idp = await IDP.deploy(8);
  await idp.deployed();

  console.log(`IDP deployed to ${idp.address}`);

  const Registry = await ethers.getContractFactory("Registry");
  const reg = await Registry.deploy(ethers.utils.zeroPad(ethers.utils.toUtf8Bytes("Trustworthy Registry"), 32), idp.address);
  await reg.deployed();

  console.log(`Registry deployed to ${reg.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
