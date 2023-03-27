import { icon } from '@fortawesome/fontawesome-svg-core';
import { faEthereum } from '@fortawesome/free-brands-svg-icons';
import { faQuestionCircle, faAddressCard, faCheck } from '@fortawesome/free-solid-svg-icons';
import { LitElement, html, css, CSSResultGroup } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { BLOCKTECH_TYPE, BLOCKTECH_TYPES, NETWORKS, REGISTRY_CONTRACT, REGISTRY_CONTRACT_GOERLI, REGISTRY_CONTRACT_HARDHAT } from '../../shared/addr';
import { SHA256Hash } from '../../shared/merkle';
import { EthereumConnector } from '../../shared/web3';
import { getIDPManager } from './idp';
import { decorateClassWithState, IState } from './state';
import { basicFlex, buttonMixin, faStyle, topDownFlex } from './styles';
import { decorateClassWithWeb3, WebEthereumConnector } from './web3';

declare global {
    interface Window { ethereum: any; }
}

export class LandingPage extends LitElement {
    static styles = [basicFlex, topDownFlex, buttonMixin, css`
        :host {
            align-items: center;
            margin-left: 1em;
            margin-right: 1em;
        }`];
    
    render() {
        return html`<h1>Sichere Petitionen für alle</h1>
        <p>Erstellen und unterschreiben Sie Petitionen auf der Blockchain. Niemand kann zurückverfolgen, welche Petitionen Sie unterschrieben haben.</p>
        <button class="hugebtn" @click=${this.loginClick}>Jetzt anmelden</button>`;
    }

    loginClick() {
        this.dispatchEvent(new CustomEvent("loginClick", { bubbles: true }));
    }
}

export class ConnectionPage extends decorateClassWithState(LitElement) {
    static styles = [faStyle, basicFlex, topDownFlex, buttonMixin, css`
        :host {
            align-items: center;
        }`];
    
    @property()
    contract?: string = null

    @property()
    chainid?: number = null
    
    render() {
        const btnDsiabled = typeof(this.contract) !== "string";
        return html`
            <span><h1>Wählen Sie eine Registrierungsstelle ${icon(faQuestionCircle).node}</h1></span>
            <registry-chooser @registryClick=${this.registryClick}></registry-chooser>
            <button class="mediumbtn${btnDsiabled ? " disabled" : ""}" ?disabled=${btnDsiabled} @click=${this.connectClick}>${icon(faEthereum).node} Einloggen</button>
        `;
    }

    registryClick(e: CustomEvent) {
        this.contract = e.detail.contract;
        this.chainid = e.detail.chainid;
        console.log("registryClick", e);
    }

    async connectClick() {
        console.log("connect: this.contract, chainid", this.contract, this.chainid);
        if(typeof(this.contract) !== "string" || typeof(this.chainid) !== "number") return;
        if(typeof(window.ethereum) === "undefined") {
            this.stateError("Zur Teilnahme wird eine kompatible Ethereum-Wallet benötigt");
            return;
        }
        try {
            await new WebEthereumConnector(window.ethereum, this.contract, null, null, this.chainid).init();
        } catch(e) {
            this.stateError(`Konnte nicht zu Ethereum verbinden. Ist die Contract-Adresse korrekt? Fehler: ${e}`);
        }
    }
}

export class RegistryChooser extends LitElement {
    static styles = [faStyle, basicFlex, topDownFlex, css`
    :host {
        align-items: center;
        word-wrap: break-word;
    }

    .entry {
        display: grid;
        grid-template-areas:
            "cb descr descr descr ident"
            "cb descr descr descr ident"
            "cb sdesc sdesc sdesc ident";
        grid-template-columns: repeat(5, 15vw);
        grid-template-rows: 1fr 1fr 1fr;
        justify-items: stretch;
        align-items: center;
        justify-content: stretch;
        align-content: start;
    }

    .acheckbox {
        grid-area: cb;
    }

    .adescr {
        grid-area: descr;
    }

    .aident {
        grid-area: ident;
    }

    .asdesc {
        grid-area: sdesc;
        color: #dddddd;
        font-size: 0.9rem;
    }

    input {
        width: 80%;
        min-height: 30px;
    }

    .invalid {
        border: 2px solid red;
    }
    `];

    @property({type: Array})
    registries: any[] = [
        {
            addr: NETWORKS.sepolia.registry_contract,
            descr: "Testcontract auf Sepolia-Blockchain",
            ident: "Texteingabe",
            chainid: NETWORKS.sepolia.chainid
        },
        {
            addr: NETWORKS.localhost.registry_contract,
            descr: "Testcontract auf lokaler Entwicklungs-Blockchain",
            ident: "Texteingabe",
            chainid: NETWORKS.localhost.chainid
        },
        {
            addr: NETWORKS.goerli.registry_contract,
            descr: "Testcontract auf Goerli-Blockchain",
            ident: "Texteingabe",
            chainid: NETWORKS.goerli.chainid
        }];

    @property({type: Boolean})
    customValid = false

    @property({type: Boolean})
    customTouched = false

    lastSelected?: number = null
    customAddr: string = ""

    render() {
        return html`
            <div class="entry">
                <div class="aident">
                ${icon(faAddressCard).node} Identifizierung durch
                </div>
            </div>
            ${this.registries.map((registry, idx) => html`
            <div class="entry">
                <div class="acheckbox">
                    <input type="radio" value="${idx}" id="contract-${idx}" name="contract" @click=${this.selectionChange}>
                </div>
                <div class="adescr" @click=${() => this.select(idx, true)}>
                    ${registry.descr}
                </div>
                <div class="asdesc" @click=${() => this.select(idx, true)}>
                    ${registry.addr}
                </div>
                <div class="aident">
                    ${registry.ident}
                </div>
            </div>
            `)}
            <div class="entry">
                <div class="acheckbox">
                    <input type="radio" value="-1" name="contract" @click=${this.selectionChange} ?disabled=${!this.customValid}>
                </div>
                <div class="adescr">
                    <input type="text" id="customcontract" class="${this.customValid || !this.customTouched ? "" : "invalid"}" @input=${this.customAddrChange}>
                </div>
                <div class="asdesc">
                    Blockchain-Adresse einer eigenen, kompatiblen Registrierungsstelle
                </div>
            </div>
        `;
    }

    select(idx: number, toggle: boolean = false) {
        this.lastSelected = idx;
        // TODO: Handle different chain ids
        this.dispatchEvent(new CustomEvent("registryClick", {
            bubbles: true,
            detail: {
                contract: this.lastSelected === -1? this.customAddr : this.registries[idx].addr,
                chainid: this.lastSelected === -1? undefined : this.registries[idx].chainid
            }
        }));
        if(toggle) (this.shadowRoot.querySelector(`#contract-${idx}`) as HTMLInputElement).checked = true;
    }

    selectionChange(e: Event) {
        const target = e.target as HTMLInputElement;
        this.select(Number.parseInt(target.value));
        console.log("selectionChange", target.value);
    }

    customAddrChange(e: Event) {
        const target = e.target as HTMLInputElement;
        const value = target.value;
        this.customTouched = true;
        this.customAddr = value;
        this.customValid = (value.length === 42 && value.startsWith("0x"));

        if(this.lastSelected === -1 && !this.customValid) {
            this.select(0, true);
        }
        console.log("customAddrChange", target.value, this.customValid);
    }
}

export class IdentityPage extends decorateClassWithState(LitElement) {
    static styles = [faStyle, basicFlex, topDownFlex, buttonMixin, css`
        :host {
            align-items: center;
        }
        
        input {
            width: 80%;
            min-height: 30px;
        }

        .invalid {
            border: 2px solid red;
        }`];
    
    @property()
    invalidName: boolean = false
    @property()
    name: string = "";

    render() {
        if (BLOCKTECH_TYPE === BLOCKTECH_TYPES.ohne_zk) {
            this.name = this.getState().connector.account;
            this.setState({
                ...this.getState(),
                identity: this.name,
                idp: getIDPManager(this.name, null, true)
            });
            return;
        }
        return html`
            <h1>Identitätsprüfung über Texteingabe</h1>

            <label for="identity">Bitte geben Sie an, wer Sie sind</label>
            <input type="text" id="identity" @keyup=${this.idKeyUp} @input=${this.idInput} class="${this.invalidName ? "invalid" : ""}" autofocus>
            <button id="check" @click=${this.verifyClick}>${icon(faCheck).node} Identität bestätigen</button>
        `;
    }

    idInput(e: Event) {
        this.name = (e.target as HTMLInputElement).value;
        this.invalidName = this.name === "";
    }

    idKeyUp(e: KeyboardEvent) {
        if(e.key === 'Enter' || e.keyCode === 13) {
            this.verifyClick();
        }
    }

    async verifyClick() {
        /**
         * Methode wird nur bei mit Zk ausgeführt.
         */
        console.log("Set Identity")
        this.idInput(
            ({
                target: this.shadowRoot.querySelector("#identity")
            }) as unknown as Event
        );
        if(this.invalidName) {
            this.stateError("Bitte geben Sie einen gültigen Namen ein");
            return;
        }
        console.log("Selected Identity:", this.name)
        this.setState({
            ...this.getState(),
            identity: this.name,
            idp: getIDPManager(this.name, null, true)
        });
    }
}