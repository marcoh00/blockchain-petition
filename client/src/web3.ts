import { LitElement } from "lit";
import Web3 from "web3";
import { EthereumConnector } from "../../shared/web3";
import { decorateClassWithState } from "./state";

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
    console.log("Attempt to connect to an Ethereum Browser Plugin");
    if(backend !== null && window.ethereum.isConnected()) return;
    backend = window.ethereum;
    window.ethereum.on('connect', (connectInfo: any) => {
        console.log("web3 connected", connectInfo);
        for(let decoratedClass of decoratedClasses) {
            decoratedClass.onWeb3Connect(backend);
        }
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
    connected: boolean
    accounts?: string[]

    constructor(provider: any, registryaddr: string, account?: string, privkey?: string, chainid?: number) {
        super(provider, registryaddr, account, privkey, chainid);
        console.log("Init WebEth Web3 with provider", provider, registryaddr, account, privkey, chainid);
        this.connected = false;
        this.accounts = [];
    }

    async init() {
        await super.init();
        await this.web3Connect();
    }

    async onAccountsChange(provider: any, accounts: string[]) {
        this.accounts = accounts;
        console.log("onAccountsChange, this.contract", this.registryaddr);
        await this.init();
        this.connected = true;
        await this.updateState();
    }

    async onWeb3Connect(provider: any): Promise<void> {
        this.connected = true;
        await this.updateState();
    }

    async onError(error: string): Promise<void> {
        this.stateError(`Fehler bei der Verbindung zu Ethereum: ${error}`);
    }

    async updateState() {
        this.setState({
            ...this.getState(),
            web3connected: this.connected,
            connector: this
        });
    }
}