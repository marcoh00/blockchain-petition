import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { decorateClassWithState, IState } from './state';

export class OverlayElement extends decorateClassWithState(LitElement) {
    @property({type: Boolean})
    spinner = true

    @property({ type: String })
    message?: string = null;

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
            background-image: linear-gradient(#57656A, #31393C);
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

        loading-spinner {
          width: 25vmin;
          height: 25vmin;
        }
    `;

    render() {
        return html`
            <div class="container ${typeof(this.message) === "string" ? `visible` : `hidden`}">
                ${this.spinner ? html`<loading-spinner></loading-spinner>` : html``}
                ${this.message}
            </div>
        `;
    }

    async stateChanged(state: IState) {
        //
    }
}

export class LoadingSpinner extends LitElement {
    static styles = css`
      .lds-ring {
        display: inline-block;
        position: relative;
        width: 100%;
        height: 100%;
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

    @property({ type: String })
    color = "#FAFFDB";

    @property({type: String})
    border = "0.3em";

    render() {
        return html`
            <style>
                .lds-ring div {
                    box-sizing: content-box;
                    display: block;
                    position: absolute;
                    width: calc(100% - ${this.border} - ${this.border});
                    height: calc(100% - ${this.border} - ${this.border});
                    margin: ${this.border};
                    border: ${this.border} solid ${this.color};
                    border-radius: 50%;
                    animation: lds-ring 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
                    border-color: ${this.color} transparent transparent transparent;
                }
          </style>
          <div class="lds-ring"><div></div></div>`;
    }
}