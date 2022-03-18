import { LitElement, html, css } from 'lit';
import { property } from 'lit/decorators.js';
import { decorateClassWithState, IState } from './state';
import { basicFlex, buttonMixin, colorfulBar, faStyle, leftRightFlex } from './styles';
import { icon } from '@fortawesome/fontawesome-svg-core';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { faEthereum } from '@fortawesome/free-brands-svg-icons';

export class InformationalInfobar extends LitElement {
    static styles = [faStyle, basicFlex, leftRightFlex, buttonMixin, colorfulBar,
        css`
            :host {
                justify-content: space-between;
                padding: 1rem 2rem;
            }
        `];

    render() {
        return html`<button>${icon(faQuestionCircle).node} Hilfe</button><button @click=${this.loginClick}>${icon(faEthereum).node} Login mit MetaMask</button>`;
    }

    loginClick() {
        this.dispatchEvent(new CustomEvent("loginClick", { bubbles: true }));
    }
}

export class NavigationBar extends LitElement {
    render() {
        return html`Navigation Bar`;
    }
}