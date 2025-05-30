import { icon } from '@fortawesome/fontawesome-svg-core';
import { faEthereum } from '@fortawesome/free-brands-svg-icons';
import { faAddressCard, faCheck, faArrowDown } from '@fortawesome/free-solid-svg-icons';
import { LitElement, html, css, PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { NETWORKS } from '../../shared/addr';
import { decorateClassWithState, IState } from './state';
import { basicFlex, buttonMixin, faStyle, topDownFlex } from './styles';
import { WalletConnector } from './web3';

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
    /** Diese Klasse ist dafür da um die Verbindung zu der Blockchain aufzubauen.
     * Das Eigentliche Verbindungsobjekt ist der WebEthereumConnector. 
     * Dieses wird im globalen State abgelegt und steht dort zur verfügung (siehe implementation von init()).
     */
    static styles = [faStyle, basicFlex, topDownFlex, buttonMixin, css`
        :host {
            align-items: center;
        }`];

    @property()
    contract?: string = null

    @property()
    chainid?: number = null

    render() {
        const btnDsiabled = typeof (this.contract) !== "string";
        return html`
            <span><h1>Wählen Sie eine Registrierungsstelle.</h1> 
            Hier müssen Sie eine Blockchain auswählen, auf der Sie eine Petition unterzeichnen möchten.</span>
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
        if (typeof (this.contract) !== "string" || typeof (this.chainid) !== "number") return;
        if (typeof (window.ethereum) === "undefined") {
            this.stateError("Zur Teilnahme wird eine kompatible Ethereum-Wallet benötigt");
            return;
        }
        try {
            await new WalletConnector(window.ethereum, this.contract).init();
        } catch (e) {
            this.stateError(`Konnte nicht zu Ethereum verbinden. Ist die Contract-Adresse korrekt? Fehler: ${e}`);
        }
    }
}

export class RegistryChooser extends LitElement {
    static styles = [faStyle, basicFlex, topDownFlex, buttonMixin, css`
    :host {
        align-items: center;
        word-wrap: break-word;
    }

    .entry {
        display: grid;
        grid-template-areas:
            "cb descr descr descr ident"
            "cb sdesc sdesc sdesc ident";
        grid-template-columns: repeat(5, 15vw);
        grid-template-rows: 1fr 1fr 1fr;
    }

    table {
        border-collapse: collapse;
        width: 100%;
        max-width: 800px;
        margin: 0 auto;
      }
      
      th, td {
        padding: 10px;
        text-align: center;
        border: 1px solid #ddd;
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

    @property({ type: Array })
    registries: any[] = [
        {
            addr: NETWORKS.localhost.registry_contract,
            descr: "Testcontract auf lokaler Blockchain",
            ident: "Texteingabe",
            chainid: NETWORKS.localhost.chainid
        },
        {
            addr: NETWORKS.localhost_zk.registry_contract,
            descr: "Testcontract auf lokaler Blockchain mit ZK",
            ident: "Texteingabe",
            chainid: NETWORKS.localhost_zk.chainid
        },
        {
            addr: NETWORKS.localhost_psssecp256k1.registry_contract,
            descr: "Testcontract auf lokaler Blockchain mit PSS/SECP256K1",
            ident: "Texteingabe",
            chainid: NETWORKS.localhost_psssecp256k1.chainid
        },
        {
            addr: NETWORKS.localhost_pssaltbn128.registry_contract,
            descr: "Testcontract auf lokaler Blockchain mit PSS/ALTBN128",
            ident: "Texteingabe",
            chainid: NETWORKS.localhost_pssaltbn128.chainid
        },
        {
            addr: NETWORKS.localhost_semaphore.registry_contract,
            descr: "Testcontract auf lokaler Blockchain mit Semaphore",
            ident: "Texteingabe",
            chainid: NETWORKS.localhost_semaphore.chainid
        },
        {
            addr: "0xe86a4d6dF4A4047b7b6d9c5d3f878eB61a53Dee2",
            descr: "Testcontract auf Sepolia Blockchain mit sema",
            ident: "Texteingabe",
            chainid: 11155111
        }
    ];

    @property({ type: Boolean })
    inputCustom = false

    @property({ type: Boolean })
    customValid = false

    @property({ type: Boolean })
    customTouched = false

    @property({ type: Boolean })
    seeAdvanced = false

    // Default Option for the HTML radio input field
    private readonly defaultOption: number = 0;

    lastSelected?: number = null
    customAddr: string = ""

    firstUpdated() {
        /**
         * This fuction is from LitElement. 
         * It is called internally by LitElement after the showdowtree has been created
         * and we use it to set the default value of the radio input box. 
         */
        this.select(this.defaultOption, true);
    }

    updated() {
        /*
         * This method is used to re-select the default option after the radio input box has been re-rendered 
         * (Beacause after the "Weitere Blockchains" botton has been clicked the previous default option is no longer selected) 
         */
        this.select(this.defaultOption, true);
    }

    private addTableRow(registry: any, idx: number) {
        let customRadioBox: any;
        // Only true if we render the last element in the registries array this is the choose custom Blockchain Option. 
        // This happens because the index of the registry element is equal to the length of the registries array minus one
        if (this.inputCustom && (idx === (this.registries.length - 1))) {
            // Eigene Blockchain eintragen
            customRadioBox = html`
            <tr>
                <td>
                    <div class="acheckbox">
                        <input type="radio" value="-1" name="contract" @click=${this.selectionChange} ?disabled=${!this.customValid}>
                    </div>
                </td>
                <td>
                    <div class="adescr">
                        <input type="text" id="customcontract" class="${this.customValid || !this.customTouched ? "" : "invalid"}" @input=${this.customAddrChange}>
                    </div>
                    <div class="asdesc">Blockchain-Adresse einer eigenen, kompatiblen Registrierungsstelle </div>
                </td>
                <td></td>
            </tr>`;
        }
        return html`
        <tr>
            <td>
                <div class="acheckbox">
                    <input type="radio" value="${idx}" id="contract-${idx}" name="contract" @click=${this.selectionChange}>
                </div>
            </td>
            <td>
                <div class="adescr" @click=${() => this.select(idx, true)}>${registry.descr}</div>
                <div class="asdesc" @click=${() => this.select(idx, true)}>${registry.addr}</div>
            </td>
            <td>
                ${registry.ident}
            </td>
        </tr> ${customRadioBox}`
    }

    render() {
        return html`
        <table>
            <thead>
            <tr>
                <th> </th>
                <th>Blockchain</th>
                <th>${icon(faAddressCard).node} Identifizierungsmethode</th>
            </tr>
            </thead>
            <tbody>
                ${this.seeAdvanced ?
                // Iterate of all registries along with their corresponding index
                this.registries.map((registry, idx) => this.addTableRow(registry, idx))
                // Set the first registry as the only registry to be rendered. 
                : html`${this.addTableRow(this.registries[this.defaultOption], this.defaultOption)}${this.addTableRow(this.registries[this.defaultOption + 1], this.defaultOption + 1)}`
            }
            </tbody>
        </table>
        ${!this.seeAdvanced ?
                html`<button class="smallbtn" @click=${() => this.seeAdvanced = !this.seeAdvanced}>${icon(faArrowDown).node} More</button>`
                // Blockchain selber eintragen (Else Fall)
                : !this.inputCustom ?
                    html`<button @click=${() => this.inputCustom = !this.inputCustom}>${icon(faArrowDown).node} Custom Registry Address</button>`
                    : ""}`;
    }

    select(idx: number, toggle: boolean = false) {
        /**
         * Function is used to set/select the chosen radio-box input field
         * in the HTML document.
         */
        this.lastSelected = idx;
        // TODO: Handle different chain ids
        this.dispatchEvent(new CustomEvent("registryClick", {
            bubbles: true,
            detail: {
                contract: this.lastSelected === -1 ? this.customAddr : this.registries[idx].addr,
                chainid: this.lastSelected === -1 ? undefined : this.registries[idx].chainid,
                blockchaintype: this.lastSelected === -1 ? undefined : this.registries[idx].chaintype,
            }
        }));
        if (toggle) {
            (this.shadowRoot.querySelector(`#contract-${idx}`) as HTMLInputElement).checked = true;
        }
    }

    selectionChange(e: Event) {
        const target = e.target as HTMLInputElement;
        this.select(Number.parseInt(target.value));
    }

    customAddrChange(e: Event) {
        const target = e.target as HTMLInputElement;
        const value = target.value;
        this.customTouched = true;
        this.customAddr = value;
        this.customValid = (value.length === 42 && value.startsWith("0x"));

        if (this.lastSelected === -1 && !this.customValid) {
            this.select(0, true);
        }
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
        return html`
            <h1>Identitätsprüfung über Texteingabe</h1>

            <label for="identity">Bitte geben Sie an, wer Sie sind</label>
            <input type="text" id="identity" @keyup=${this.idKeyUp} @input=${this.idInput} class="${this.invalidName ? "invalid" : ""}" autofocus>
            <button id="check" @click=${this.verifyClick}>${icon(faCheck).node} Identität bestätigen</button>
        `;
    }

    firstUpdated(changedProperties: PropertyValues): void {
        super.firstUpdated(changedProperties);
        (this.shadowRoot.querySelector("#identity") as HTMLInputElement).focus();
    }

    idInput(e: Event) {
        this.name = (e.target as HTMLInputElement).value;
        this.invalidName = this.name === "";
    }

    idKeyUp(e: KeyboardEvent) {
        if (e.key === 'Enter' || e.keyCode === 13) {
            this.verifyClick();
        }
    }

    async verifyClick() {
        this.idInput(
            ({
                target: this.shadowRoot.querySelector("#identity")
            }) as unknown as Event
        );
        if (this.invalidName) {
            this.stateError("Bitte geben Sie einen gültigen Namen ein");
            return;
        }
        console.log("Selected Identity:", this.name)
        this.setState({
            ...this.getState(),
            identity: this.name
        });
    }
}