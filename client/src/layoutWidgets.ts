import { icon } from '@fortawesome/fontawesome-svg-core';
import { faCheck, faClose, faRefresh } from '@fortawesome/free-solid-svg-icons';
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { IPetition } from '../../shared/web3';
import { BLOCKTECH_TYPE, BLOCKTECH_TYPES } from '../../shared/addr';
import { decorateClassWithState, IState } from './state';
import { basicFlex, buttonMixin, faStyle, topDownFlex } from './styles';
import { getZokratesHelper } from './zokrates';
import { NoEntryError } from './keys';

enum PageStage {
    Landing,
    ChooseConnection,
    Identity,
    PetitionSign
}
export class PetitionApp extends decorateClassWithState(LitElement) {
    
    /* Valid stages
     * 0 = Landing Page
     * 1 = Registry + Wallet
     * 2 = Identity
     * 3 = Main functionality
     */

    @property()
    stage: PageStage = PageStage.Landing;

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
            this.stage = PageStage.Identity;
        }
        if(web3connected && identityknown) {
            this.stage = PageStage.PetitionSign;
        }
    }

    getNavigationBar() {
        if (this.stage === PageStage.Landing || this.stage === PageStage.ChooseConnection) {
            return html`<informational-infobar @loginClick=${this.proceedConnection}></informational-infobar>`;
        } else {
            return html`<navigation-bar @pageClick=${this.pageClick}></navigation-bar>`;
        }
    }

    getMainPage() {
        switch (this.stage) {
            case PageStage.Landing:
                return html`<landing-page @loginClick=${this.proceedConnection}></landing-page>`;
            case PageStage.ChooseConnection:
                return html`<connection-page @web3connect=${this.proceedIdentity}></connection-page>`;
            case PageStage.Identity:
                return html`<identity-page></identity-page>`;
            case PageStage.PetitionSign:
                if (this.page === "create") {
                    return html`<create-petition @pageClick=${this.pageClick}></create-petition>`;
                }
                return html`<main-page></main-page>`;
        }
    }

    proceedConnection() {
        this.stage = PageStage.ChooseConnection;
        if(this.getState().web3connected) this.proceedIdentity();
    }

    proceedIdentity() {
        this.stage = PageStage.Identity;
        const state = this.getState();
        if(typeof(state.identity) === "string"
            && typeof(state.idp) === "object") this.proceedMain();
    }

    proceedMain() {
        this.stage = PageStage.PetitionSign;
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
            flex-grow: 9;
            overflow: scroll;
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

        .link {
            cursor: pointer;
        }
        `];
    
    connectedCallback() {
        super.connectedCallback();
        console.log("Main Page connected");
        const state = this.getState();
        const statePetitions = state.repository.petitions_by_period[state.period];
        this.petitions = Array.isArray(statePetitions) ? statePetitions : [];
    }

    render() {
        console.log("Render Petitions", this.petitions);
        let sign_func = (this.getState().connector.blockchaintype === BLOCKTECH_TYPES.ohne_zk) ? this.signPetition : this.signPetition_zk;
        return html`
            <div class="cardlist">
                <h1>Petitionen <span class="link" @click=${this.refreshClick}>${icon(faRefresh).node}</span></h1>
                ${this.petitions.map((petition, idx) => html`<petition-card .petition=${petition} .idx=${idx} .signable=${this.isSignable(petition) && petition.signable} @sign=${sign_func}></petition-card>`)}
            </div>
        `
    }

    async refreshClick() {
        await this.getState().repository.init();
    }

    async stateChanged(state: IState): Promise<void> {
        this.petitions = state.repository.petitions_by_period[state.period];
        if(!Array.isArray(this.petitions)) this.petitions = [];
    }

    isSignable(petition: IPetition) : boolean {
        const state = this.getState();
        const signable = state.repository.period_time_cache[petition.period].isNow();
        console.log(`petition w/ period ${petition.period} is signable? ${signable}`);
        return signable;
    }

    async signPetition(e: CustomEvent) {
        const petition = this.petitions[e.detail as number];
        if(!petition.signable) {
            this.stateError("Sie haben diese Petition bereits unterzeichnet");
            return;
        }
        if(!this.isSignable(petition)) {
            this.stateError("Es können ausschließlich Petitionen der aktuellen Abstimmungsperiode (s.o.) unterzeichnet werden");
            return;
        }
        try {
            await this.getState().provider.sign(petition);
        }
        catch(e) {
            if(e == NoEntryError) {
                this.stateError("Please register with the identity provider first");
            } else {
                this.stateError(`Could not sign petition: ${e}`);
            }
        }
        await this.getState().repository.init();
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
            <p>Bitte beachten Sie, dass die Petitiondaten auf einer Blockchain gespeichert werden. Sie können nach der Veröffentlichung nicht geändert oder gelöscht werden. Längere Petitionstexte verursachen größere Transaktionsgebühren.</p>
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
            locktext: "Bestätigung durch Blockchain abwarten"
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