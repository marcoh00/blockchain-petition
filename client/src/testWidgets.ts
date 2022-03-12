import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { SHA256Hash } from '../../shared/merkle';
import { decorateClassWithState, IState } from './state';

import Web3 from 'web3';
import { decorateClassWithWeb3 } from './web3';
import { EthereumConnector, IPetition } from '../../shared/web3';
import { REGISTRY_CONTRACT } from '../../shared/addr';
import { threadId } from 'worker_threads';
import {ZokratesTester} from "./zokrates";

declare global {
    interface Window { ethereum: any; }
}

export class MetaMaskConnector extends decorateClassWithWeb3(decorateClassWithState(LitElement)) {
    @property()
    connected = false;

    provider?: Web3 = null;

    @property()
    accounts: Array<string> = [];

    @property()
    idpurl: string

    constructor() {
        super();
        this.connected = false;
        this.accounts = [];
        this.idpurl = "";
    }

    render() {
        return html`<h1>Ethereum connection</h1>
        ${window.ethereum ? html`${this.ethAvailable()}` : html`Ethereum unavailable`}
        `
    }

    ethAvailable() {
        return !this.connected ? html`<button @click=${this.connectClick}>Connect with MetaMask</button>` : this.accountsView();
    }

    accountsView() {
        return html`
            ${this.accounts.map((account) => html`<div class="account">Account: ${account.toString()}</div>`)}
            <div class="info">Registry: ${this.getState().connector.registryaddr}</div>
            <div class="info">IDP @ <a href="${this.idpurl}">${this.idpurl}</a></div>
        `;
    }

    async onWeb3Connect(provider: any) {
        const connector = new EthereumConnector(provider, REGISTRY_CONTRACT);
        await connector.init();
        console.log("connector", connector);
        this.setState({
            ...this.getState(),
            web3connected: true,
            period: await connector.period(),
            connector
        });
        await this.setInfo();
    }

    async setInfo() {
        this.idpurl = await this.getState().connector.url();
    }

    async stateChanged(state: IState): Promise<void> {
        this.connected = state.web3connected;
    }

    async onAccountsChange(provider: any, accounts: string[]) {
        this.accounts = accounts;
        const connector = new EthereumConnector(provider, REGISTRY_CONTRACT, accounts[0]);
        console.log("Connector:", connector);
        await connector.init();
        this.setState({
            ...this.getState(),
            web3connected: true,
            connector
        });
        await this.setInfo();
    }

    connectClick() {
        this.web3Connect();
        console.log("Widget: connectClick registered");
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
            <h1>Key Generation</h1>
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
                    <input type="number" @input=${this.valueChange} id="period" value="${this.period}" placeholder="305000">
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

        const privkey_hash = await SHA256Hash.hashRaw(privstring_hash.rawValue());
        this.pubkey = `${privkey_hash.toHex()}`;

        if(state.privkey === undefined || state.pubkey === undefined || !privstring_hash.equals(state.privkey) || !privkey_hash.equals(state.pubkey)) {
            this.setState({
                ...state,
                privkey: privstring_hash,
                pubkey: privkey_hash
            })
        }
    }

    async valueChange(e: InputEvent) {
        const target = e.target as HTMLInputElement;
        if(target.id === "identity") {
            this.identity = target.value;
        }
        if(target.id === "period") {
            this.period = Number.parseInt(target.value);
        }
        this.setState({...this.getState(),
            identity: this.identity,
            period: this.period
        });
    }
}

export class CredentialRetriever extends decorateClassWithState(LitElement) {
    @property()
    keypair_available: boolean

    @property()
    token?: string

    @property()
    credentials?: string

    constructor() {
        super();
        this.keypair_available = false;
    }

    render() {
        return html`
            <h1>IDP Registration</h1>
            ${this.keypair_available ? this.registrationDialog() : html`<div class="info">No Public/Private keypair was generated`}`;
    }

    registrationDialog() {
        return html`
            <div class="descr">Token:</div>
            <div class="elem">${typeof(this.token) === "string" ? html`${this.token}` : html`<button @click=${this.getTokenClick}>Obtain Token from IDP</button>`}</div>
            ${typeof(this.token) === "string" ? this.exchangeDialog() : html``}
        `
    }

    exchangeDialog() {
        return html`
            <div class="descr">Credentials:</div>
            <div class="elem">${typeof(this.credentials) === "string" ? html`<pre>${this.credentials}</pre>` : html`<button @click=${this.getCredentialsClick}>Exchange Token into credentials</button>`}</div>
        `
    }

    async getTokenClick() {
        const endpoint = await this.getState().connector.url();
        const state = this.getState();
        const token_or_error = await fetch(`${endpoint}/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                identity: state.identity,
                pubkey: state.pubkey.toHex(),
                period: state.period
            })
        });
        const response = await token_or_error.json();
        console.log("Response from IDP", response);
        if(Object.keys(response).indexOf("error") > -1) {
            this.setState({
                ...state,
                error: response.error.toString()
            });
            console.log("Error while trying to obtain token!", response.error);
            setTimeout(() => this.setState({...this.getState(), error: undefined}), 5000);
            return;
        }
        if(Object.keys(response).indexOf("token") > -1) {
            this.setState({
                ...state,
                token: response.token.toString()
            });
        }
    }

    async getCredentialsClick() {
        const endpoint = await this.getState().connector.url();
        const state = this.getState();
        const proof_or_error = await fetch(`${endpoint}/proof`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                token: state.token
            })
        });
        const response = await proof_or_error.json();
        console.log("Response from IDP", response);
        if(Object.keys(response).indexOf("error") > -1) {
            this.setState({
                ...state,
                error: response.error.toString()
            });
            console.log("Error while trying to exchange token!", response.error);
            setTimeout(() => this.setState({...this.getState(), error: undefined}), 5000);
            return;
        }
        if(Object.keys(response).indexOf("hash") > -1) {
            this.setState({
                ...state,
                credentials: response
            });
        }
    }

    async stateChanged(state: IState): Promise<void> {
        this.keypair_available = false;
        if(typeof(state.pubkey) === "object" && typeof(state.privkey) === "object") this.keypair_available = true;
        if(typeof(state.token) === "string") this.token = state.token;
        if(typeof(state.credentials) === "object") this.credentials = JSON.stringify(state.credentials);
    }
}

export class PetitionList extends decorateClassWithState(LitElement) {
    @property()
    connected: boolean = false;

    @property()
    zokratesArgumentInputString: string = "";

    @property()
    zokratesProof: string = "";

    @property()
    petitions: IPetition[] = [];

    static styles = css`
        .petition {
            margin-left: 1em;
            margin-bottom: 3em;
        }

        .name {
            font-size: medium;
            font-weight: bold;
        }

        .descr {
            margin-bottom: 1em;
        }
    `;


    getInputValue(e: InputEvent) {
        // Selecting the input element and get its value
        //let inputVal = document.getElementById("identityX").innerText;
        // Displaying the value
        alert((e.target as HTMLInputElement).id);
    }

    inputProof(e: InputEvent){
        const target = e.target as HTMLInputElement;
        if(target.name === "proof") {
            this.zokratesProof = target.value;
        }
    }

    // takeProof(e: InputEvent){
    //     alert(this.zokratesProof);
    // }<button type="button" @click=${this.takeProof}>Get Value</button>

    render() {
        return html`
            ${this.zokratesArgumentInputString ? html`
                <textarea> ${this.zokratesArgumentInputString} </textarea>
                <textarea  @input=${this.inputProof} name="proof" placeholder="Proof"> </textarea>
            ` : html``}
            <h1>Petitionsliste</h1>
            ${this.connected ? html`
                ${this.petitions.map((petition, idx) => html`
                    <div class="petition">
                        <div class="name">${petition.name}</div>
                        <div class="descr">${petition.description}</div>
                        <div class="period">Zeitperiode: ${petition.period} (${(petition as any).start}-${(petition as any).end})</div>
                        <div class="id">ID: ${petition.id}</div>
                        <div class="signers">Unterschriften: ${petition.signers}</div>
                        <div class="sign"><button .disabled=${(petition as any).disabled} .id=${idx} @click=${this.signClick}>Unterschreiben</button></div>
                    </div>
                `)}
            ` : html`
                <div class="info">Not connected to web3</div>
            `}`;
    }

    hexStringToDecimalStringArray(hexString: string) {
        const intString:string[] = [];
        for (let i = 0; i < 64; i+=8) {
            //intString.push(parseInt(hexString.substring(i, i + 7), 16).valueOf().toString());
            intString.push(Number( "0x" + hexString.substring(i, i + 8)).toString(10));
        }
        return intString;
    }

    async signClick(e: InputEvent) {
        const idx = Number.parseInt((e.target as HTMLInputElement).id);
        const pers = [
            ...Array.from(this.petitions[idx].id),
            ...Array.from(this.getState().privkey.rawValue())
        ];
        console.log("pers", pers);
        const hpers = await SHA256Hash.hashRaw(new Uint8Array(pers));
        console.log("credentials", this.getState().credentials)
        //rt, H_pers, pID, Kpriv, Kpub, directionSelector(bool 3), merkleproof(3*8)

        if(!this.zokratesArgumentInputString){
            let zokratesbeweisInput:string = "zokrates compute-witness --input stimmrechtsbeweis -a ";
            this.hexStringToDecimalStringArray(this.getState().credentials.hash).forEach(x => zokratesbeweisInput = zokratesbeweisInput +  x +" ");
            this.hexStringToDecimalStringArray(hpers.toHex()).forEach(x => zokratesbeweisInput = zokratesbeweisInput +  x +" ");
            this.hexStringToDecimalStringArray(Buffer.from(this.petitions[idx].id).toString('hex')).forEach(x => zokratesbeweisInput = zokratesbeweisInput +  x +" ");
            this.hexStringToDecimalStringArray(this.getState().privkey.toHex()).forEach(x => zokratesbeweisInput = zokratesbeweisInput + x +" ");
            this.hexStringToDecimalStringArray(this.getState().pubkey.toHex()).forEach(x => zokratesbeweisInput = zokratesbeweisInput + x +" ");

            let directionSelectorDecimalStringArray: string[] = [];
            for (let i = 0; i < this.getState().credentials.proof.directionSelector.length; i++) {
                directionSelectorDecimalStringArray.push(this.getState().credentials.proof.directionSelector[i] ? '1' : '0');
            }

            let merklePathDecimalStringArray:string[][] = [];
            for (let i=0; i<this.getState().credentials.proof.path.length; i++){
                merklePathDecimalStringArray.push(this.hexStringToDecimalStringArray(this.getState().credentials.proof.path[i]));
            }

            directionSelectorDecimalStringArray.forEach(x => zokratesbeweisInput = zokratesbeweisInput + x +" ");
            merklePathDecimalStringArray.forEach(x => x.forEach(y => zokratesbeweisInput = zokratesbeweisInput + y +" "));
            zokratesbeweisInput = zokratesbeweisInput + "&& zokrates generate-proof --input stimmrechtsbeweis && cat proof.json | pbcopy";
            this.zokratesArgumentInputString = zokratesbeweisInput;
            console.log("zokratesbeweisInput", zokratesbeweisInput);
            //console.log("merklePath-out", merklePathDecimalStringArray)
            //directionSelectorDecimalStringArray.forEach(x => zokratesbeweisInput = zokratesbeweisInput + x +" ");
            //merklePathDecimalStringArray.forEach(x => x.forEach(y => zokratesbeweisInput = zokratesbeweisInput + y +" "));

            // const proof  = new ZokratesTester().constructProof(
            //     this.getState().credentials.hash,
            //     hpers.toHex(),
            //     Buffer.from(this.petitions[idx].id).toString('hex'),
            //     this.getState().privkey.toHex(),
            //     this.getState().pubkey.toHex(),
            //     this.getState().credentials.proof.directionSelector,
            //     this.getState().credentials.proof.path);
            return
        }

        if (this.zokratesProof){
            try {
                JSON.parse(this.zokratesProof)
            } catch(e) {
                alert(e); // error in the above string (in this case, yes)!
            }

            //Verifier.Proof calldata lProof, uint8 lIteration, bytes32 lIdentity
            const tx = await this.getState().connector.signPetition(
                this.petitions[idx].address,
                this.zokratesProof,
                hpers,
                this.getState().credentials.iteration);
            console.log("transaction", tx);

            this.zokratesArgumentInputString = "";
            this.zokratesProof = "";
        }
    }

    async stateChanged(state: IState) {
        const wasConnected = this.connected;
        this.connected = state.web3connected;
        if(this.connected && !wasConnected) {
            const petitions = await this.getState().connector.petitions();
            const now = Date.now();
            for(const petition of petitions) {
                const start = new Date(await state.connector.startPeriod(petition.period) * 1000);
                const end = new Date(await state.connector.startPeriod(petition.period + 1) * 1000);
                (petition as any).start = start;
                (petition as any).end = end;
                (petition as any).disabled = now < start.getTime() || now > end.getTime();
            }
            this.petitions = petitions;
            console.log(this.petitions);
        }
    }
}