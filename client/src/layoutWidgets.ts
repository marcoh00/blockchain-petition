import { icon } from '@fortawesome/fontawesome-svg-core';
import { faCheck, faClose } from '@fortawesome/free-solid-svg-icons';
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { IPetition } from '../../shared/web3';
import { decorateClassWithState, IState } from './state';
import { basicFlex, buttonMixin, faStyle, topDownFlex } from './styles';
import { getZokratesHelper } from './zokrates';

export class PetitionApp extends decorateClassWithState(LitElement) {
    
    /* Valid stages
     * 0 = Landing Page
     * 1 = Registry + Wallet
     * 2 = Identity
     * 3 = Main functionality
     */

    @property()
    stage: number = 0

    @property()
    page = "main";

    static styles = [basicFlex, topDownFlex, css`navigation-bar { max-width: 100vw; border-collapse: collapse; }`];

    render() {
        return html`
            ${this.getNavigationBar()}
            ${this.getMainPage()}
            <error-view></error-view>
        `;
    }

    async stateChanged(state: IState): Promise<void> {
        const web3connected = state.web3connected
            && typeof(state.connector) === "object";
        const identityknown = typeof(state.identity) === "string"
            && typeof(state.idp) === "object";
        if(web3connected && !identityknown) {
            this.stage = 2;
        }
        if(web3connected && identityknown) {
            this.stage = 3;
        }
    }

    getNavigationBar() {
        return this.stage === 0 || this.stage === 1 ? html`<informational-infobar @loginClick=${this.proceedConnection}></informational-infobar>` : html`<navigation-bar @pageClick=${this.pageClick}></navigation-bar>`;
    }

    getMainPage() {
        if(this.stage === 0) return html`<landing-page @loginClick=${this.proceedConnection}></landing-page>`;
        else if(this.stage === 1) return html`<connection-page @web3connect=${this.proceedIdentity}></connection-page>`;
        else if(this.stage === 2) return html`<identity-page></identity-page>`;
        else if(this.stage === 3 && this.page === "create") return html`<create-petition @pageClick=${this.pageClick}></create-petition>`
        return html`<main-page></main-page>`;
    }

    proceedConnection() {
        this.stage = 1;
        if(this.getState().web3connected) this.proceedIdentity();
    }

    proceedIdentity() {
        this.stage = 2;
        const state = this.getState();
        if(typeof(state.identity) === "string"
            && typeof(state.idp) === "object") this.proceedMain();
    }

    proceedMain() {
        this.stage = 3;
    }

    pageClick(e: CustomEvent) {
        this.page = e.detail;
    }
}

export class ErrorView extends decorateClassWithState(LitElement) {
    @property({ type: String })
    error?: string = null;

    static styles = [faStyle, css`
        .container {
            position: fixed;
            width: 90%;
            height: 10%;
            min-height: 3rem;
            left: 5%;
            bottom: 2rem;
            border-radius: 0.4em;
            background-color: #f8961e;
            color: #333333;
            padding: 1em;

            display: flex;
            flex-flow: row nowrap;
            justify-content: center;
            align-items: center;
        }

        .message {
            flex-grow: 9
        }

        .btn {
            flex-grow: 1;
            font-size: 2rem;
            cursor: pointer;
        }
    `];

    render() {
        return typeof(this.error) === "string"? html`
            <div class="container">
                <div class="message">
                    ${this.error}
                </div>
                <div class="btn" @click=${this.closeClick}>
                    ${icon(faClose).node}
                </div>
            </div>
        ` : html``;
    }

    closeClick() {
        this.setState({
            ...this.getState(),
            error: undefined
        });
    }

    async stateChanged(state: IState): Promise<void> {
        this.error = state.error;
    }
}


export class MainPage extends decorateClassWithState(LitElement) {
    @property({ type: Array })
    petitions: IPetition[] = [];
    
    static styles = [faStyle, basicFlex, topDownFlex, css`
        :host {
            align-items: stretch;
        }
        
        .cardlist {
            display: flex;
            flex-flow: column wrap;
            align-items: stretch;
            gap: 1em;
            margin: auto 4rem;
        }
        `];
    
    connectedCallback() {
        super.connectedCallback();
        console.log("Main Page connected");
        const state = this.getState();
        this.petitions = state.repository.petitions_by_period[state.period];
    }

    render() {
        console.log("Render Petitions", this.petitions);
        return html`
            <div class="cardlist">
                <h1>Petitionen</h1>
                ${this.petitions.map((petition, idx) => html`<petition-card .petition=${petition} .idx=${idx} .signable=${this.isSignable(petition)} @sign=${this.signPetition}></petition-card>`)}
            </div>
        `
    }

    async stateChanged(state: IState): Promise<void> {
        this.petitions = state.repository.petitions_by_period[state.period];
        if(!Array.isArray(this.petitions)) this.petitions = [];
    }

    isSignable(petition: IPetition) {
        const state = this.getState();
        const signable = state.repository.period_time_cache[petition.period].isNow();
        console.log(`petition w/ period ${petition.period} is signable? ${signable}`);
        return signable;
    }

    async signPetition(e: CustomEvent) {
        const petition = this.petitions[e.detail as number];
        if(!this.isSignable(petition)) {
            this.stateError("Es können ausschließlich Petitionen der aktuellen Abstimmungsperiode (s.o.) unterzeichnet werden");
            return;
        }
        const idp = this.getState().idp;
        if(typeof(idp.getRegistrationData(petition.period).privkey) !== "object") {
            this.stateError("Vor der Unterzeichnung muss ein Identitätsnachweis beantragt werden");
            return;
        }
        const helper = await getZokratesHelper();
        console.log("signPetition, before proof", petition, helper);
        const proof = await helper.constructProof(petition, idp);
        console.log("ZoKrates should be initialized now, cmdline would've been", proof.cmdline);

        this.setState({
            ...this.getState(),
            lockspinner: true,
            locktext: "Petition unterschreiben"
        });
        try {
            const tx = await this.getState().connector.signPetition(petition.address, proof.points, proof.hpers, idp.getRegistrationData(petition.period).credentials.iteration);
            console.log("Petition signed successfully!", tx);
        } catch(e) {
            this.stateError(`Konnte Transaktion nicht versenden: ${e}`);
        }
        this.setState({
            ...this.getState(),
            lockspinner: false,
            locktext: undefined
        });
    }
}

export class CreatePage extends decorateClassWithState(LitElement) {
    static styles = [faStyle, basicFlex, topDownFlex, buttonMixin, css`
        :host {
            align-items: center;
            margin-left: 1em;
            margin-right: 1em;
        }
        
        input {
            width: 80%;
            min-height: 30px;
        }

        textarea {
            width: 80%;
            min-height: 20vh;
            min-width: 33vw;
        }

        .invalid {
            border: 2px solid red;
        }`];
    
    @property()
    title: string

    @property()
    invalidTitle: boolean

    render() {
        return html`
            <h1>Petition erstellen</h1>

            <label for="title">Titel (max. 30 Zeichen)</label>
            <input type="text" id="title" @input=${this.titleInput} class="${this.invalidTitle ? "invalid" : ""}" autofocus>
            <label for="petitiontext">Text der Petition</label>
            <textarea id="petitiontext"></textarea>
            <button id="check" @click=${this.verifyClick}>${icon(faCheck).node} Petition veröffentlichen</button>
            <p>Bitte beachten Sie, dass die Petitiondaten auf einer Blockchain gespeichert werden. Sie können nicht geändert oder gelöscht werden. Längere Petitionstexte verursachen größere Transaktionsgebühren.</p>
        `;
    }

    titleInput(e: Event) {
        this.title = (e.target as HTMLInputElement).value;
        this.invalidTitle = this.title === "" || this.title.length > 30;
    }

    async verifyClick() {
        this.titleInput(
            ({
                target: this.shadowRoot.querySelector("#title")
            }) as unknown as Event
        );
        if(this.invalidTitle) {
            this.stateError("Bitte geben Sie einen gültigen Titel ein");
            return;
        }
        
        this.setState({
            ...this.getState(),
            lockspinner: true,
            locktext: "Petition erstellen"
        });
        const state = this.getState();
        try {
            await state.connector.createPetition(
                this.title,
                (this.shadowRoot.querySelector("#petitiontext") as HTMLInputElement).value,
                state.period
            )
        } catch(e) {
            this.stateError(`Konnte Petition nicht erstellen: ${e}`)
        }
        this.setState({
            ...this.getState(),
            lockspinner: false,
            locktext: undefined
        });
        await this.getState().repository.init();
        this.dispatchEvent(new CustomEvent("pageClick", { bubbles: true, detail: "main" }));
    }
}