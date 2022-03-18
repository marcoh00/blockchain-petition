import { icon } from '@fortawesome/fontawesome-svg-core';
import { faEthereum } from '@fortawesome/free-brands-svg-icons';
import { faQuestionCircle, faAddressCard } from '@fortawesome/free-solid-svg-icons';
import { LitElement, html, css, CSSResultGroup } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { REGISTRY_CONTRACT } from '../../shared/addr';
import { EthereumConnector } from '../../shared/web3';
import { decorateClassWithState, IState } from './state';
import { basicFlex, buttonMixin, faStyle, topDownFlex } from './styles';
import { decorateClassWithWeb3 } from './web3';

export class LandingPage extends LitElement {
    static styles = [basicFlex, topDownFlex, buttonMixin, css`
        :host {
            align-items: center;
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

export class ConnectionPage extends decorateClassWithWeb3(decorateClassWithState(LitElement)) {
    static styles = [faStyle, basicFlex, topDownFlex, buttonMixin, css`
        :host {
            align-items: center;
        }`];
    
    @property()
    contract?: string = null
    
    render() {
        const btnDsiabled = typeof(this.contract) !== "string";
        return html`
            <span><h1>Wählen Sie eine Registrierungsstelle ${icon(faQuestionCircle).node}</h1></span>
            <registry-chooser @registryClick=${this.registryClick}></registry-chooser>
            <button class="mediumbtn${btnDsiabled ? " disabled" : ""}" ?disabled=${btnDsiabled} @click=${this.connectClick}>${icon(faEthereum).node} Einloggen</button>
        `;
    }

    registryClick(e: CustomEvent) {
        this.contract = e.detail;
        console.log("registryClick", e);
    }

    async onAccountsChange(provider: any, accounts: string[]) {
        this.accounts = accounts;
        const connector = new EthereumConnector(provider, this.contract, accounts[0]);
        console.log("Connector:", connector);
        await connector.init();
        this.setState({
            ...this.getState(),
            web3connected: true,
            connector
        });
    }

    connectClick() {
        if(typeof(this.contract) !== "string") return;
        if(typeof(window.ethereum) === "undefined") {
            this.stateError("Zur Teilnahme wird eine kompatible Ethereum-Wallet benötigt");
            return;
        }
        this.web3Connect();
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

    @property({type: Object})
    registries: any[] = [
        {
            addr: REGISTRY_CONTRACT,
            descr: "Testcontract auf Entwicklungs-Blockchain",
            ident: "Texteingabe"
        },
        {
            addr: REGISTRY_CONTRACT,
            descr: "Petitionen der Verbraucherzentrale NRW",
            ident: "Personalausweis"
        },
        {
            addr: "0xb3Aff715Cf9d2D9a65F0992F93777Ccf3c7fa6e0",
            descr: "change.org Blockchain-Petitionen",
            ident: "E-Mail"
        },
        {
            addr: "0xbB718Ac6A21a837d1F66992F93777Ccf3c7fa6e0",
            descr: "Dachverband kommunaler Bürgerinitiativen e.V.",
            ident: "Facebook (OpenID)"
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
        this.dispatchEvent(new CustomEvent("registryClick", {
            bubbles: true,
            detail: this.lastSelected === -1? this.customAddr : this.registries[idx].addr
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