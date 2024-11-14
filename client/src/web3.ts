import { EthereumConnector, getWeb3Connector, PetitionType } from "../../shared/web3";
import { IDPManager } from "./idp";
import { KeyManager, NaiveKeyManager, ZKKeyManager } from "./keys";
import { IClientProvider, NaiveClientProvider, PssClientProvider, ZKClientProvider } from "./provider";
import { decorateClassWithState } from "./state";
import { getWeb3Repository, Web3Repository } from "./web3repository";

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
        if (backend !== null && window.ethereum.isConnected()) resolve();
        backend = window.ethereum;
        window.ethereum.on('connect', (connectInfo: any) => {
            console.log("web3 connected", connectInfo);
            for (let decoratedClass of decoratedClasses) {
                decoratedClass.onWeb3Connect(backend);
            }
            resolve();
        });
        window.ethereum.on('accountsChanged', (accounts: string[]) => {
            console.log("web3 accounts changed", accounts);
            for (let decoratedClass of decoratedClasses) {
                decoratedClass.onAccountsChange(backend, accounts);
            }
        });
        window.ethereum.on("error", (error: any) => {
            console.log("web3 error", error);
            for (let decoratedClass of decoratedClasses) {
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
                for (let decoratedClass of decoratedClasses) {
                    decoratedClass.onWeb3Connect(backend);
                    decoratedClass.onAccountsChange(backend, accounts);
                }
                if (window.ethereum.isConnected()) {
                    resolve();
                }
            })
            .catch((e: string) => {
                console.log("web3 init: failed to update accounts", e);
                reject();
            })
    });
    return connectionPromise;
}

export function decorateClassWithWeb3<T extends ClassType>(decorated: T) {
    return class extends decorated implements IWeb3Connected {
        constructor(...args: any[]) {
            super(...args);
            decoratedClasses.push(this);
        }
        async onWeb3Connect(provider: any) { }
        async onAccountsChange(provider: any, accounts: string[]) { }
        async onError(error: string) { }
        web3Connect = localWeb3Connect;
    }
}

class WebEthereumConnectorBase { }
export class WalletConnector extends decorateClassWithWeb3(decorateClassWithState(WebEthereumConnectorBase)) {
    accounts: string[]
    provider: any
    registryaddr: string
    connector?: EthereumConnector
    connected: boolean

    constructor(provider: any, registryaddr: string) {
        super();
        console.log("Init WebEth Web3 with provider", provider, registryaddr);
        this.provider = provider;
        this.registryaddr = registryaddr;
        this.connected = false;
        this.accounts = [];
    }

    async init() {
        console.trace("[WalletConnector] start init");
        await this.web3Connect();
        console.log("[WalletConnector] web3connect successful");
        this.connector = await getWeb3Connector(this.provider, this.registryaddr);
        this.connected = true;
        await this.updateState();
    }

    async onAccountsChange(provider: any, accounts: string[]) {
        this.accounts = accounts;
        // We consider ourselves connected when we've been given access to at least one account
        // and as soon as our EthereumConenctor is initialized.
        // This check is important: During the initialization phase (`this.web3Connect()`)
        // this callback is called with the selected accounts.
        // However, at this point in time, the web3connector wasn't set which will cause updateState to fail.
        this.connected = (this.accounts.length > 0 && typeof this.connector === "object");
        console.log("[WalletConnector] onAccountsChange", this, this.connected);
        await this.updateState();
    }

    async onWeb3Connect(provider: any): Promise<void> {
        console.log("[WalletConnector] onWeb3connect");
    }

    async onError(error: string): Promise<void> {
        this.stateError(`Fehler bei der Verbindung zu Ethereum: ${error}`);
    }

    async client_provider(): Promise<IClientProvider> {
        const t = await this.connector.petitiontype();
        switch (t) {
            case PetitionType.Naive:
                return new NaiveClientProvider();
            case PetitionType.ZK:
                return new ZKClientProvider();
            case PetitionType.PSSSecp256k1:
                return new PssClientProvider();
            case PetitionType.PSSAltBn128:
                return new PssClientProvider();
            default:
                throw new Error(`Unknown petition type ${t}`);
        }
    }

    async updateState() {
        /**
         * UpdateState verändert den State von der PetitionApp. 
         */
        const init_state = this.getState();
        const new_connection = this.connected && init_state.connector !== this;
        if (new_connection) {
            const web3added = {
                ...init_state,
                connector: this
            }
            this.setState(web3added);
            const repository = new Web3Repository(this.connector);
            const idp = new IDPManager(await this.connector.idpcontract.methods.url().call());
            if (init_state.identity) {
                await idp.set_identity(init_state.identity);
                idp.load()
            }
            this.setState({
                ...this.getState(),
                repository,
                idp
            });
        }
    }
}