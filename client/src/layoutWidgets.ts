import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { decorateClassWithState, IState } from './state';
import { basicFlex, topDownFlex } from './styles';

export class PetitionApp extends decorateClassWithState(LitElement) {
    
    /* Valid stages
     * 0 = Landing Page
     * 1 = Registry + Wallet
     * 2 = Identity
     * 3 = Main functionality
     */

    @property()
    stage: number = 0

    static styles = [basicFlex, topDownFlex];

    render() {
        return html`
            ${this.getNavigationBar()}
            ${this.getMainPage()}
        `;
    }

    async stateChanged(state: IState): Promise<void> {
        if(state.web3connected
            && typeof(state.connector) === "object"
            && typeof(state.identity) === "string"
            && typeof(state.privkey) === "object"
            && typeof(state.pubkey) === "object") {
                this.stage = 3;
            }
    }

    getNavigationBar() {
        return this.stage === 0 || this.stage === 1 || this.stage === 2 ? html`<informational-infobar @loginClick=${this.proceedConnection}></informational-infobar>` : html`<navigation-bar></navigation-bar>`;
    }

    getMainPage() {
        if(this.stage === 0) return html`<landing-page @loginClick=${this.proceedConnection}></landing-page>`;
        else if(this.stage === 1) return html`<connection-page></connection-page>`;
        else if(this.stage === 2) return html`<identity-page></identity-page>`;
        return html`<main-page></main-page>`;
    }

    proceedConnection() {
        this.stage = 1;
    }
}
