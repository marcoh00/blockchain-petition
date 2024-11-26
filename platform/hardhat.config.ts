import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";

import { DEFAULT_NETWORK, NETWORKS } from "../shared/addr";
import { SolcUserConfig } from "hardhat/types";

dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

task("imining", "Switch to interval-based mining", async (taskArgs, hre) => {
  const interval = 8000;
  await hre.network.provider.send("evm_setAutomine", [false]);
  console.log(`Automine disabled`);
  await hre.network.provider.send("evm_setIntervalMining", [interval]);
  console.log(`Interval Mining set to ${interval}ms`);
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const pss_verifier_settings: SolcUserConfig = {
  version: "0.8.24",
  settings: {
    optimizer: {
      enabled: true,
      runs: 20000,
      details: {
        yul: true
      }
    },
    viaIR: true
  }
};

const semaphore_settings: SolcUserConfig = {
  version: "0.8.23",
  settings: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  }
};

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.24"
      },
      {
        version: "0.8.23",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      }
    ],
    "overrides": {
      "contracts/PssAltBn128.sol": pss_verifier_settings,
      "contracts/PssSecp256k1.sol": pss_verifier_settings,
      "@zk-kit/lean-imt.sol/Constants.sol": semaphore_settings,
      "@zk-kit/lean-imt.sol/InternalLeanIMT.sol": semaphore_settings,
      "poseidon-solidity/PoseidonT3.sol": semaphore_settings
    }
  },
  networks: {
    hardhat: {
      mining: {
        auto: true
      },
    },
    goerli: {
      url: NETWORKS.goerli.api,
      accounts:
        [NETWORKS.goerli.privkey]
    },
    seclab: {
      url: NETWORKS.seclab.api,
      chainId: NETWORKS.seclab.chainid,
      accounts:
        [NETWORKS.seclab.privkey]
    },
    sshsepolia: {
      url: NETWORKS.sshsepolia.api,
      chainId: NETWORKS.sshsepolia.chainid,
      accounts:
        [NETWORKS.sshsepolia.privkey]
    },
    default: {
      url: DEFAULT_NETWORK.api,
      accounts:
        [DEFAULT_NETWORK.privkey]
    }
  }
};

export default config;
