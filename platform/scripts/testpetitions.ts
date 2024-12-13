import { readFileSync } from "fs";
import { ethers } from "hardhat";

async function main() {
  const contracts = JSON.parse(readFileSync("scaddr.json").toString());

  const RegistryFactory = await ethers.getContractFactory("Registry");
  const Registry = await RegistryFactory.attach(contracts.naive.registry as string);
  console.log(`Attached naive to registry with verifier ${await Registry.verifier()}`);

  const Registry_zk = await RegistryFactory.attach(contracts.zk.registry as string);
  console.log(`Attached to ZK registry with verifier ${await Registry_zk.verifier()}`);

  const Registry_psssecp256k1 = await RegistryFactory.attach(contracts.psssecp256k1.registry as string);
  console.log(`Attached to PSS Secp256k1 registry with verifier ${await Registry_psssecp256k1.verifier()}`);

  const Registry_pssaltbn128 = await RegistryFactory.attach(contracts.pssaltbn128.registry as string);
  console.log(`Attached to PSS Altbn128 registry with verifier ${await Registry_pssaltbn128.verifier()}`);

  const Registry_semaphore = await RegistryFactory.attach(contracts.semaphore.registry as string);
  console.log(`Attached to Semaphore registry`);

  const IDPFactory = await ethers.getContractFactory("NaiveIDP");
  const IDP = await IDPFactory.attach(contracts.naive.idp);

  const IDPFactory_zk = await ethers.getContractFactory("ZKIDP");
  const IDP_zk = await IDPFactory_zk.attach(contracts.zk.idp);

  const IDPFactory_psssecp256k1 = await ethers.getContractFactory("PSSIDP");
  const IDP_psssecp256k1 = await IDPFactory_psssecp256k1.attach(contracts.psssecp256k1.idp);

  const names = [
    "Save the Rainforests",
    "Support Local Farmers",
    "End Plastic Pollution",
    "Protect Wildlife Corridors",
    "Affordable Education for All"
  ];
  const descriptions = [
    `Our rainforests are disappearing at an alarming rate. We call on policymakers to enforce stricter regulations against deforestation and support sustainable practices. Together, we can protect biodiversity and combat climate change.`,
    `Local farmers need our help! Demand subsidies and fair pricing policies to ensure their livelihoods and promote healthy, homegrown produce. Let's prioritize our communities and sustainable agriculture over corporate farming.`,
    `Single-use plastics are choking our oceans. Join us in urging governments to ban non-recyclable plastics and invest in innovative, eco-friendly materials. It's time to protect marine life and preserve our planet for future generations.`,
    `Urban expansion threatens critical wildlife corridors. Advocate for smart planning and conservation measures that ensure animals can roam safely in their habitats. Together, we can maintain balance in our ecosystems.`,
    `Education is a right, not a privilege. Sign this petition to push for increased funding for public schools and accessible higher education. Let's break barriers and create opportunities for everyone.`
  ];
  const ids = [
    "0x0000000000000000000000000000000000000000000000000000000000000000",
    "0x0000000000000000000000000000000000000000000000000000000000000001",
    "0x0000000000000000000000000000000000000000000000000000000000000002",
    "0x0000000000000000000000000000000000000000000000000000000000000003",
    "0x10000000000000000000000000000000000000000000000000000000000000F0"
  ];
  const baseperiod = Number(await IDP.period());
  const periods = [
    baseperiod,
    baseperiod,
    0,
    baseperiod + 2,
    baseperiod + 3
  ];

  const baseperiod_zk = Number(await IDP_zk.period());
  const periods_zk = [
    baseperiod_zk,
    baseperiod_zk,
    0,
    baseperiod_zk + 2,
    baseperiod_zk + 3
  ];

  const baseperiod_pss = Number(await IDP_psssecp256k1.period());

  const submittable_names = names
    .map((name) => ethers.zeroPadBytes(ethers.toUtf8Bytes(name), 32));
  for (let i = 0; i < names.length; i++) {
    await Registry.createPetition(submittable_names[i], descriptions[i], periods[i]);
    console.log(`[NAIVE] Petition ${names[i]} added`)
  }

  for (let i = 0; i < names.length; i++) {
    await Registry_zk.createPetition(submittable_names[i], descriptions[i], periods_zk[i]);
    console.log(`[ZK]    Petition ${names[i]} added`)
  }

  for (let i = 0; i < names.length; i++) {
    await Registry_psssecp256k1.createPetition(submittable_names[i], descriptions[i], baseperiod_pss);
    console.log(`[PSS psssecp256k1]   Petition ${names[i]} added`)
  }

  for (let i = 0; i < names.length; i++) {
    await Registry_pssaltbn128.createPetition(submittable_names[i], descriptions[i], baseperiod_pss);
    console.log(`[PSS pssaltbn128]   Petition ${names[i]} added`)
  }

  for (let i = 0; i < names.length; i++) {
    await Registry_semaphore.createPetition(submittable_names[i], descriptions[i], baseperiod_pss);
    console.log(`[Semaphore]         Petition ${names[i]} added`)
  }


}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
