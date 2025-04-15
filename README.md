# Technical Prototype for Petitions on the Blockchain

This repository provides a prototype for a blockchain-based petition system.  
The following components are included:

## Client

Web frontend for users.  
Connects to an available wallet and generates IDP- and period-specific keys.  
Can interact with a `Registry` contract to learn all details about the petition system in use.  
Subsequently interacts with `IDP` and `Petition` contracts to generate valid signatures.

## IDP

Identity Provider.  
Identifies users and adds their public keys to a Merkle tree, which is periodically written to the blockchain.  
Issues credentials to users in the form of Merkle proofs, enabling them to participate in petitions.

IDPs are trusted by definition: misbehavior by IDPs may result in (real or fake) users being able to vote multiple times.  
If IDPs refuse to issue credentials, they can exclude users from participating in the system.  
Once the Merkle tree is written to the blockchain and the corresponding proof is delivered, credentials can no longer be revoked by the IDPs.  
IDPs cannot trace which petitions users have signed.

## Smart Contract Platform

Smart contracts for data storage of IDP, Registry, and Petition.

## ZoKrates Program for Generating ZK-SNARKs

This project uses [ZoKrates](https://zokrates.github.io) to generate zero-knowledge proofs, which can verify the correct execution of programs written in the ZoKrates language (see below).

# Protocol

Time is divided into periods based on block timestamps.  
The IDP contract defines the length of these periods.

All steps listed below must be executed anew for each voting period.  
Each petition is strictly assigned to a single voting period.

1.  `Client -> (ID, K_pub) -> IDP`
    ```
    ID = [implementation-specific, e.g., SSI- or eIDAS-based]
    K_priv = rnd()
    K_pub = PRF(K_priv)
    ```

    The IDP verifies:
    - `ID` has not yet been identified for the current voting period (the ability to make multiple entries per ID and period equates to the ability to vote multiple times)

2.  `IDP -> (Merkle-Root incl. K_pub) -> IDP-SC`

    `IDP -> (Merkle-Proof, Index) -> Client`

    At fixed intervals, the IDP generates a Merkle tree of verified identifiers. The root hash (`rt`) is written to the blockchain, and the client receives a Merkle proof of the inclusion of their `K_pub` and the index at which `rt` can be retrieved from the blockchain.

3.  `Client -> (H_pers, Index, ZK) -> Petition-SC`

    The client creates a hash from the petition ID and their private key.

    ```
    rt = (IDP-SC).get(Index)
    H_pers = h(ID_Petition, K_priv)
    ZK = ZK-SNARK(public rt, public H_pers, public ID_Petition, private K_priv, private K_pub, private directionSelector, private merkleproof)
    ```

    The ZK proof verifies the following conditions:
     - `K_pub = PRF(K_priv)` (i.e., `K_priv` is known and is the pre-image of `K_pub`)
    - `H_pers` is correctly computed
    - `rt` contains `K_pub` (using `merkleproof`)

    The Petition-SC verifies:
    - `rt` is retrievable from the `IDP` smart contract at the given index
    - `ZK` is valid
    - `H_pers` has not yet been included in the list of previous signatures

4.  The total number of signatures corresponds to the size of the array of all `H_pers` for the voting period.

# Installation

A current version of [nodejs](https://nodejs.org) is required.

Install the shared library (run in the [shared](shared) folder):
```
npm install
```

## Smart Contract Platform
In the [platform](platform) folder

Install dependencies:
```
npm install
```

Start the development server:
```
npx hardhat node
```

Deploy the smart contracts:
```
npx hardhat run --network localhost scripts/deploy.ts
```

Add test petitions:
```
npx hardhat run --network localhost scripts/testpetitions.ts
```

## IDP
In the [idp](idp) folder

Install dependencies:
```
npm install
```

Configuration is currently done via constants in `shared/addr.ts`:
```
const port = 65535;
const account = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';
const privkey = '0xea6c44ac03bff858b476bba40716402b03e41b8e97e276d1baec7c37d42484a0';
const api = 'ws://127.0.0.1:8545';
const contract = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const databasefile = `/home/mhuens2m/build/petition/idp/dist/database.db`;
```

Start the ZK server:
```
npm run start -- --type zk --port 65530
```

Start the non-ZK server:
```
npm run start -- --type normal --port 65535
```

## Client
In the [client](client) folder

Install dependencies:
```
npm install
```

Start the Webpack development server:
```
npm run dev
```

## Frontend

Once the Webpack server is running, the client is available at [http://localhost:8080](http://localhost:8080) by default.  
To use the system, a web3-compatible browser plugin such as [MetaMask](https://metamask.io) is required.  
To access full functionality, the development blockchain must be added as a network.  
By default, it is available at `localhost:8545` and has the chain ID `31337`.  
To submit transactions, an account with cryptocurrency must be imported.  
The corresponding private keys are printed when starting the blockchain development server (see "Smart Contract Platform").
