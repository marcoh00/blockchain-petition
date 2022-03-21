import { icon } from '@fortawesome/fontawesome-svg-core';
import { faClose } from '@fortawesome/free-solid-svg-icons';
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { decorateClassWithState, IState } from './state';
import { basicFlex, faStyle, topDownFlex } from './styles';

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
            <error-view></error-view>
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
        if(this.stage == 1 && state.web3connected) this.proceedIdentity();
    }

    getNavigationBar() {
        return this.stage === 0 || this.stage === 1 || this.stage === 2 ? html`<informational-infobar @loginClick=${this.proceedConnection}></informational-infobar>` : html`<navigation-bar></navigation-bar>`;
    }

    getMainPage() {
        if(this.stage === 0) return html`<landing-page @loginClick=${this.proceedConnection}></landing-page>`;
        else if(this.stage === 1) return html`<connection-page @web3connect=${this.proceedIdentity}></connection-page>`;
        else if(this.stage === 2) return html`<identity-page></identity-page>`;
        return html`<main-page></main-page>`;
    }

    proceedConnection() {
        this.stage = 1;
    }

    proceedIdentity() {
        this.stage = 2;
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