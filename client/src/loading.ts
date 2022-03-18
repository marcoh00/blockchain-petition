import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { decorateClassWithState } from './state';

export class LoadData extends decorateClassWithState(LitElement) {
    @property({type: Boolean})
    active = true

    @property({ type: String })
    loaded_total = ""
    @property({ type: String })
    total = ""
    @property({ type: String })
    last_loaded = "";

    static styles = css`
        .hidden {
            display: none;
        }
        .visible {
            display: flex;
        }
        .container {
            width: 100vw;
            height: 100vh;
            background-color: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            flex-flow: column nowrap;
            justify-content: center;
            align-items: center;
            align-content: center;
            position: absolute;
            top: 0;
            left: 0;
            z-index: 10;
        }
    `;

    constructor() {
        super();
    }

    render() {
        return html`
            <div class="container ${this.active ? `visible` : `hidden`}">
                <loading-spinner></loading-spinner>
                <p>${this.loaded_total}/${this.total}</p>
                <p>${this.last_loaded}</p>
            </div>
        `;
    }
}

@customElement("loading-spinner")
export class LoadingSpinner extends LitElement {
    static styles = css`
      .lds-ring {
        display: inline-block;
        position: relative;
        width: 80px;
        height: 80px;
      }
      .lds-ring div {
        box-sizing: border-box;
        display: block;
        position: absolute;
        width: 64px;
        height: 64px;
        margin: 8px;
        border: 8px solid #000000;
        border-radius: 50%;
        animation: lds-ring 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
        border-color: #000000 transparent transparent transparent;
      }
      .lds-ring div:nth-child(1) {
        animation-delay: -0.45s;
      }
      .lds-ring div:nth-child(2) {
        animation-delay: -0.3s;
      }
      .lds-ring div:nth-child(3) {
        animation-delay: -0.15s;
      }
      @keyframes lds-ring {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }      
    `;

    render() {
        return html`<div class="lds-ring"><div></div></div>`;
    }
}