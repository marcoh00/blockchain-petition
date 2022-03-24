import { icon } from "@fortawesome/fontawesome-svg-core";
import { faArrowDown, faPenToSquare, faSign } from "@fortawesome/free-solid-svg-icons";
import { css, CSSResultGroup, html, LitElement } from "lit";
import { property } from "lit/decorators.js";
import { IPetition } from "../../shared/web3";
import { buttonMixin, faStyle } from "./styles";

export class Petition extends LitElement {
    static styles = [faStyle, buttonMixin, css`

        :host {
            width: 100%;
        }

        .card {
            box-shadow: 5px 3px 8px rgba(61,83,102,0.3);
            transition: 0.3s;
            background-color: rgb(87, 117, 144);
            color: #000000;
            border-radius: 3px;
        }

        .card:hover {
            box-shadow: 7px 5px 10px rgba(61,83,102,0.6);
        }

        .container {
            padding: 0.8rem 1.6rem 0.6rem;
        }

        h4 {
            margin: 1.2rem auto;
        }

        .titlebar {
            display: flex;
            flex-flow: row nowrap;
            justify-content: space-between;
            align-items: center;
        }

        .toggle {
            cursor: pointer;
        }

        .hidden {
            display: none;
            transition: 0.1s;
        }

        .descr {
            text-align: justify;
        }
    `]

    @property({ type: Object })
    petition: IPetition

    @property()
    expanded: boolean = false;

    @property()
    signable: boolean = true;

    render() {
        return html`
            <div class="card">
                <div class="container">
                    <div class="titlebar" @click=${this.toggle}>
                        <h4>${this.petition.name}</h4>
                        <div @click=${this.toggle} class="toggle">${icon(faArrowDown).node}</div>
                    </div>
                    <div class="${this.expanded ? `` : `hidden`}">
                        <p class="descr">${this.petition.description}</p>
                        <p>Unterschriften: ${this.petition.signers}</p>
                        <button class="${this.signable ? "" : "disabled"}" @click=${this.signClick}>${icon(faPenToSquare).node} Unterschreiben</button>
                    </div>
                </div>
            </div>
        `;
    }

    toggle() {
        this.expanded = !this.expanded;
    }

    signClick(e: Event) {
        e.stopPropagation();
        e.preventDefault();
        window.alert("Noch nicht implementiert :(");
    }
}