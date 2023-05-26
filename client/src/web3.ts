import { LitElement } from "lit";
import Web3 from "web3";
import { EthereumConnector } from "../../shared/web3";
import { decorateClassWithState } from "./state";
import { getWeb3Repository } from "./web3repository";
import { BLOCKTECH_TYPES } from "../../shared/addr";

interface IWeb3Connected {
    onWeb3Connect(provider: any): Promise<void>
    onAccountsChange(provider: any, accounts: string[]): Promise<void>
    web3Connect(): Promise<void>
    onError(error: string): Promise<void>
}

let backend: any = null;
const decoratedClasses: IWeb3Connected[] = [];

type ClassType = new (...args: any[]) => any;

export async function localWeb3Connect() {
    const connectionPromise = new Promise<void>((resolve, reject) => {
        console.log("Attempt to connect to an Ethereum Browser Plugin");
        if(backend !== null && window.ethereum.isConnected()) resolve();
        backend = window.ethereum;
        window.ethereum.on('connect', (connectInfo: any) => {
            console.log("web3 connected", connectInfo);
            for(let decoratedClass of decoratedClasses) {
                decoratedClass.onWeb3Connect(backend);
            }
            resolve();
        });
        window.ethereum.on('accountsChanged', (accounts: string[]) => {
            console.log("web3 accounts changed", accounts);
            for(let decoratedClass of decoratedClasses) {
                decoratedClass.onAccountsChange(backend, accounts);
            }
        });
        window.ethereum.on("error", (error: any) => {
            console.log("web3 error", error);
            for(let decoratedClass of decoratedClasses) {
                decoratedClass.onError(error);
            }
            reject();
        })
        window.ethereum
            .request({
                method: "eth_requestAccounts"
            })
            .then((accounts: string[]) => {
                console.log("Initial connect", accounts);
                for(let decoratedClass of decoratedClasses) {
                    decoratedClass.onWeb3Connect(backend);
                    decoratedClass.onAccountsChange(backend, accounts);
                }
            })
            .catch((e: string) => {
                console.log("web3 init: failed to update accounts");
                reject();
            })
    });
    return connectionPromise;
}

export function decorateClassWithWeb3<T extends ClassType>(decorated: T) {
    return class extends decorated implements IWeb3Connected {
        constructor(...args: any[]) {
            super(...args);
            console.log("construct web3 decorator", ...args);
            decoratedClasses.push(this);
        }
        async onWeb3Connect(provider: any) {}
        async onAccountsChange(provider: any, accounts: string[]) {}
        async onError(error: string) {}
        web3Connect = localWeb3Connect;
    }
}

export class WebEthereumConnector extends decorateClassWithWeb3(decorateClassWithState(EthereumConnector)) {
    accounts?: string[]

    constructor(provider: any, registryaddr: string, account?: string, privkey?: string, chainid?: number,
        blockchaintype?: BLOCKTECH_TYPES) {
        super(provider, registryaddr, account, privkey, chainid, blockchaintype);
        console.log("Init WebEth Web3 with provider", provider, registryaddr, account, privkey, chainid, blockchaintype);
        this.connected = false;
        this.accounts = [];
    }

    async init() {
        console.log("webeth.web3connect");
        console.trace()
        await this.web3Connect();
        console.log("webeth.super.init");
        await super.init();
        this.connected = true;
        await this.updateState();
    }

    async onAccountsChange(provider: any, accounts: string[]) {
        this.accounts = accounts;
        if(accounts.length > 0) this.account = accounts[0];
        console.log("onAccountsChange, this.contract", this.registryaddr);
        await super.init();
        this.connected = true;
        await this.updateState();
    }

    async onWeb3Connect(provider: any): Promise<void> {
        console.log("onWeb3connect");
    }

    async onError(error: string): Promise<void> {
        this.stateError(`Fehler bei der Verbindung zu Ethereum: ${error}`);
    }

    async updateState() {
        /**
         * UpdateState verändert den State von der PetitionApp. 
         */
        const init_state = this.getState();
        const new_connection = this.connected && init_state.connector !== this;
        if(new_connection) {
            const web3added = {
                ...init_state,
                web3connected: this.connected,
                connector: this
            }
            this.setState(web3added);
            const repository = await getWeb3Repository(this);
            this.setState({
                ...this.getState(),
                repository
            });
        }
    }
}