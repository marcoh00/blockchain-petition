export const REGISTRY_CONTRACT_HARDHAT = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
export const REGISTRY_CONTRACT_GOERLI = "0x99DC5A12d18afDdfF802980353A5be36Fd7247A3";
export const REGISTRY_CONTRACT_GOERLI_PUBLIC = "0xE74d9d7e37aC285634a69BC5196C0e5Fd8a025d8";
export const REGISTRY_CONTRACT_SEPOLIA = "0xcCB184e2aeF7fF89E4739897e5564F351469a9f0";
export const REGISTRY_CONTRACT = REGISTRY_CONTRACT_HARDHAT;

export const PORT = 65535;

export const ACCOUNT_SECLAB = "0xA29876C7964C0aFf4190Ec78c811751F6b238CE7";
export const PRIVKEY_SECLAB = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
export const ACCOUNT_GOERLI = "0xA007D87E607D25E0f203Bc949392142b59bb9a83";
export const PRIVKEY_GOERLI = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
export const PRIVKEY = PRIVKEY_SECLAB;

export const ACCOUNT_HARDHAT = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';
export const PRIVKEY_HARDHAT = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
export const ACCOUNT = ACCOUNT_SECLAB;

export const API_SECLAB = "http://127.0.0.1:18444"
export const API_HARDHAT = 'ws://127.0.0.1:8545';
export const API_GOERLI = "https://eth-goerli.alchemyapi.io/v2/APIKEY";
export const API_GOERLI_LOCAL = "http://192.168.178.50:8545";
export const API_GOERLI_WS_LOCAL = "ws://192.168.178.50:8546";
export const API = API_SECLAB;

export const API_SEPOLIA_LAB = "http://192.168.66.10:8545"
export const API_SEPOLIA_WS_LAB = "ws://192.168.66.10:8546"
export const API_SEPOLIA_LOCAL = "http://127.0.0.1:8545"
export const API_SEPOLIA_WS_LOCAL = "ws://127.0.0.1:8546"

export const DBFILE = `./database.db`;
export const PROVINGKEY = "../zk/proving.key";

interface INetworkConnectionSettings {
    api: string
    wsapi?: string
    chainid: number
    account: string
    privkey: string
    registry_contract?: string
}

interface INetworkList {
    [network: string]: INetworkConnectionSettings
}

export const NETWORKS: INetworkList = {
    localhost: {
        api: API_HARDHAT,
        wsapi: API_HARDHAT,
        chainid: 31337,
        account: ACCOUNT_HARDHAT,
        privkey: PRIVKEY_HARDHAT,
        registry_contract: REGISTRY_CONTRACT_HARDHAT
    },
    sepolia: {
        api: API_SEPOLIA_LAB,
        wsapi: API_SEPOLIA_WS_LAB,
        chainid: 11155111,
        account: ACCOUNT_GOERLI,
        privkey: PRIVKEY_GOERLI,
        registry_contract: REGISTRY_CONTRACT_GOERLI_PUBLIC
    },
    sshsepolia: {
        api: API_SEPOLIA_LOCAL,
        wsapi: API_SEPOLIA_WS_LOCAL,
        chainid: 11155111,
        account: ACCOUNT_GOERLI,
        privkey: PRIVKEY_GOERLI,
        registry_contract: REGISTRY_CONTRACT_GOERLI_PUBLIC
    },
    goerli: {
        api: API_GOERLI_LOCAL,
        wsapi: API_GOERLI_WS_LOCAL,
        chainid: 5,
        account: ACCOUNT_GOERLI,
        privkey: PRIVKEY_GOERLI,
        registry_contract: REGISTRY_CONTRACT_GOERLI_PUBLIC
    },
    seclab: {
        api: API_SECLAB,
        wsapi: "ws://localhost:8546",
        chainid: 43,
        account: ACCOUNT_SECLAB,
        privkey: PRIVKEY_SECLAB,
        registry_contract: "0x6fB4ae4D171f76054987507DAfa158A2DA6F5335"
    }
}
export const DEFAULT_NETWORK = NETWORKS.localhost
