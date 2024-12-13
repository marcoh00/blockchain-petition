import { readFileSync, writeFileSync } from "fs";
import { ethers } from "hardhat";

interface IContractAddresses {
  idp: string,
  registry: string,
  verifier: string | null,
  semaphore?: string,
  idp_args: string,
  registry_args: string,
  verifier_args: string | null
}

interface ISCInfo {
  [t: string]: IContractAddresses
}

enum KeyType {
  Naive,
  ZK,
  Secp256k1PSS,
  AltBn128PSS,
  Semaphore
}

function argumentsJsForVerify(...args: any[]): string {
  return `module.exports = ${JSON.stringify(args)};`
}

async function deployPss(keyfile: string, keytype: KeyType, idpcontract: string, verifiercontract: string, port: number, registrybuilder: any): Promise<IContractAddresses> {
  const PSSIDP = await ethers.getContractFactory(idpcontract);
  const idp_pss = await PSSIDP.deploy(`http://localhost:${port}`, keytype);
  const idp_args = argumentsJsForVerify(`http://localhost:${port}`, keytype);
  console.log(`IDP PSS for ${verifiercontract} deployed to ${await idp_pss.getAddress()}`);

  const pss_key = JSON.parse(readFileSync(keyfile).toString());
  let link_opts = {};
  if (keytype == KeyType.AltBn128PSS) {
    link_opts = {
      libraries: {
        Pairing: await (await (await ethers.getContractFactory("contracts/Altbn128.sol:Pairing")).deploy()).getAddress()
      }
    };
  }
  const PSSVerifier = await ethers.getContractFactory(verifiercontract, link_opts);
  const pk_m = {
    X: `0x${pss_key.pk_m_x}`,
    Y: `0x${pss_key.pk_m_y}`
  };
  const pk_icc = {
    X: `0x${pss_key.pk_icc_x}`,
    Y: `0x${pss_key.pk_icc_y}`
  }
  const pk_sector = {
    X: `0x${pss_key.sectors[0].pk_sector_x}`,
    Y: `0x${pss_key.sectors[0].pk_sector_y}`
  }
  console.log("Verifier keys:", "pk_m", pk_m, "pk_icc", pk_icc, "pk_sector", pk_sector, "pk_sector_x_test", BigInt(pk_sector.X));
  const verifier_pss = await PSSVerifier.deploy(pk_m, pk_icc, pk_sector);
  const verifier_args = argumentsJsForVerify(pk_m, pk_icc, pk_sector);
  const verifier_pss_addr = await verifier_pss.getAddress();
  console.log(`PSS Verifier ${verifiercontract} deployed to ${verifier_pss_addr}`);

  const reg_pss = await registrybuilder.deploy(
    ethers.zeroPadBytes(ethers.toUtf8Bytes(`PSS ${verifiercontract} Registry`), 32),
    await idp_pss.getAddress(),
    verifier_pss_addr,
    keytype
  );
  const reg_args = argumentsJsForVerify(
    ethers.zeroPadBytes(ethers.toUtf8Bytes(`PSS ${verifiercontract} Registry`), 32),
    await idp_pss.getAddress(),
    verifier_pss_addr,
    keytype
  );
  //await reg_pss.deployed();
  console.log(`Registry PSS for ${verifiercontract} deployed to ${await reg_pss.getAddress()}. Verifier address is ${await reg_pss.verifier()}`);
  return { idp: await idp_pss.getAddress(), registry: await reg_pss.getAddress(), verifier: verifier_pss_addr, idp_args: idp_args, registry_args: reg_args, verifier_args: verifier_args };
}

async function main() {
  const NaiveIDP = await ethers.getContractFactory("NaiveIDP");
  const ZKIDP = await ethers.getContractFactory("ZKIDP");

  // rt depth = 8
  // ~ 2^8 = 256 identities per hour can be added to the IDP's merkle tree
  // validity = 604800 ~ 1 week
  // 5400 ~ 90min
  const idp_naive = await NaiveIDP.deploy(18000, "http://localhost:65535");
  const idp_naive_args = argumentsJsForVerify(18000, "http://localhost:65535");

  const idp_zk = await ZKIDP.deploy(18000, "http://localhost:65530", 3);
  const idp_zk_args = argumentsJsForVerify(18000, "http://localhost:65530", 3);

  //await idp_naive.deployed();
  console.log(`IDP deployed to ${await idp_naive.getAddress()}`);

  //await idp_zk.deployed();
  console.log(`IDP ZK deployed to ${await idp_zk.getAddress()}`);

  const ZKVerifier = await ethers.getContractFactory("Verifier");
  const verifier_zk = await ZKVerifier.deploy();
  //await verifier_zk.deployed();
  console.log(`ZK Verifier deployed to ${await verifier_zk.getAddress()}`);

  const Registry = await ethers.getContractFactory("Registry");

  const psscontracts: ISCInfo = {};
  try {
    psscontracts.psssecp256k1 = await deployPss("../pss/secp256k1key.json", KeyType.Secp256k1PSS, "PSSIDP", "PssSecp256k1", 65525, Registry);
    psscontracts.pssaltbn128 = await deployPss("../pss/altbn128key.json", KeyType.AltBn128PSS, "PSSIDP", "PssAltBn128", 65520, Registry);
  }
  catch (e) {
    console.trace("Could not deploy PSS Verifier", e);
    await new Promise((resolve, reject) => setTimeout(() => resolve(undefined), 5000));
  }

  const reg_naive = await Registry.deploy(
    ethers.zeroPadBytes(ethers.toUtf8Bytes("Naive Registry"), 32),
    await idp_naive.getAddress(),
    "0x0000000000000000000000000000000000000000",
    0
  );
  const reg_naive_args = argumentsJsForVerify(
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
  const reg_zk_args = argumentsJsForVerify(
    ethers.zeroPadBytes(ethers.toUtf8Bytes("ZK Registry"), 32),
    await idp_zk.getAddress(),
    await verifier_zk.getAddress(),
    1
  );
  //await reg_zk.deployed();
  console.log(`Registry ZK deployed to ${await reg_zk.getAddress()}`);

  let link_opts = {
    libraries: {
      PoseidonT3: await (await (await ethers.getContractFactory("poseidon-solidity/PoseidonT3.sol:PoseidonT3")).deploy()).getAddress()
    }
  };

  const SemaphoreIDP = await ethers.getContractFactory("SemaphoreIDP", link_opts);
  const idp_semaphore = await SemaphoreIDP.deploy("http://localhost:65515");
  const idp_semaphore_args = argumentsJsForVerify("http://localhost:65515");
  console.log(`IDP Semaphore deployed to ${await idp_semaphore.getAddress()}`);

  const reg_semaphore = await Registry.deploy(
    ethers.zeroPadBytes(ethers.toUtf8Bytes("Semaphore Registry"), 32),
    await idp_semaphore.getAddress(),
    "0x0000000000000000000000000000000000000000",
    4
  );
  const reg_semaphore_args = argumentsJsForVerify(
    ethers.zeroPadBytes(ethers.toUtf8Bytes("Semaphore Registry"), 32),
    await idp_semaphore.getAddress(),
    "0x0000000000000000000000000000000000000000",
    4
  );
  console.log(`Registry Semaphore deployed to ${await reg_semaphore.getAddress()}`);

  console.log("psscontracts", psscontracts);

  const addresses: ISCInfo = {
    naive: {
      idp: await idp_naive.getAddress(),
      registry: await reg_naive.getAddress(),
      verifier: null,
      idp_args: idp_naive_args,
      registry_args: reg_naive_args,
      verifier_args: null
    },
    zk: {
      idp: await idp_zk.getAddress(),
      registry: await reg_zk.getAddress(),
      verifier: await verifier_zk.getAddress(),
      idp_args: idp_zk_args,
      registry_args: reg_zk_args,
      verifier_args: null
    },
    semaphore: {
      idp: await idp_semaphore.getAddress(),
      registry: await reg_semaphore.getAddress(),
      semaphore: await idp_semaphore.getSemaphore(),
      verifier: null,
      idp_args: idp_semaphore_args,
      registry_args: reg_semaphore_args,
      verifier_args: null
    },
    ...psscontracts
  };
  writeFileSync("scaddr.json", JSON.stringify(addresses));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
