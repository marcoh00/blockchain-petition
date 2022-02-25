import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { SHA256Hash } from '../../shared/merkle';
import { decorateClassWithState, IState } from './state';

import Web3 from 'web3';

declare global {
    interface Window { ethereum: any; }
}

export class MetaMaskConnector extends decorateClassWithState(LitElement) {
    @property()
    connected = false;

    provider?: Web3 = null;
    accounts: Array<any> = [];

    constructor() {
        super();
        this.connected = false;
        this.accounts = [];
    }

    render() {
        return html`
        ${window.ethereum ? html`Ethereum available ${this.ethAvailable()}` : html`Ethereum unavailable`}
        `
    }

    ethAvailable() {
        return !this.connected ? html`<button @click=${this.connectClick}>Connect with MetaMask</button>` : this.accountsView();
    }

    accountsView() {
        return html`${this.accounts}`
    }

    connectClick() {
        window.ethereum.enable();
        this.provider = new Web3(window.ethereum);
        this.connected = true;
        this.provider.eth.getAccounts().then(accounts => {
            console.log("Accounts", accounts);
            this.accounts = accounts;
        });
    }
}

export class KeyGenerator extends decorateClassWithState(LitElement) {
    static styles = css`
        .layout {
            display: flex;
            flex-flow: column wrap;
            justify-content: center;
        }
        .descr {
            flex-basis: 30%;
        }
        .main {
            flex-basis: 60%;
        }
    `;

    @property()
    pubkey: string
    
    @property()
    privkey: string

    @property()
    privstring: string

    @property()
    identity: string;

    @property()
    period: number;

    constructor() {
        super();
        this.identity = "";
        this.period = 0;
    }

    render() {
        return html`
            <div class="layout">
                <div class="descr">
                    Identity
                </div>
                <div class="main">
                    <input type="text" @input=${this.valueChange} id="identity" placeholder="Identity">
                </div>
                <div class="descr">
                    Period
                </div>
                <div class="main">
                    <input type="number" @input=${this.valueChange} id="period" placeholder="305000">
                </div>
                <div class="descr">
                    Privkey (String)
                </div>
                <div class="main">
                    ${this.privstring}
                </div>
                <div class="descr">
                    Privkey (h(privstring))
                </div>
                <div class="main">
                    ${this.privkey}
                </div>
                <div class="descr">
                    Pubkey (h(h(privstring)))
                </div>
                <div class="main">
                    ${this.pubkey}
                </div>
            </div>
        `;
    }

    async stateChanged(state: IState) {
        console.log("State changed", state);
        this.period = state.period;
        this.identity = state.identity;

        this.privstring = `${this.period}||${this.identity}`;
        const privstring_hash = await SHA256Hash.hashString(this.privstring);

        this.privkey = `${privstring_hash.toHex()}`;
        this.pubkey = `${(await SHA256Hash.hashRaw(privstring_hash.rawValue())).toHex()}`;
    }

    async valueChange(e: InputEvent) {
        const target = e.target as HTMLInputElement;
        if(target.id === "identity") {
            this.identity = target.value;
        }
        if(target.id === "period") {
            this.period = Number.parseInt(target.value);
        }
        this.setState({
            identity: this.identity,
            period: this.period
        });
    }
}