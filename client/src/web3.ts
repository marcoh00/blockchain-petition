import { LitElement } from "lit";
import Web3 from "web3";

interface IWeb3Connected {
    onWeb3Connect(provider: any): Promise<void>
    onAccountsChange(provider: any, accounts: string[]): Promise<void>
    web3Connect(): Promise<void>
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
            super(args);
            decoratedClasses.push(this);
        }
        async onWeb3Connect(provider: any) {}
        async onAccountsChange(provider: any, accounts: string[]) {}
        web3Connect = localWeb3Connect;
    }
}