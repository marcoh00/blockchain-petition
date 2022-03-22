import { icon } from "@fortawesome/fontawesome-svg-core";
import { faArrowDown, faPenToSquare, faSign } from "@fortawesome/free-solid-svg-icons";
import { css, CSSResultGroup, html, LitElement } from "lit";
import { property } from "lit/decorators.js";
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
    `]

    @property()
    title: string

    @property()
    expanded: boolean = false;

    render() {
        return html`
            <div class="card">
                <div class="container">
                    <div class="titlebar">
                        <h4>${this.title}</h4>
                        <div @click=${this.toggle} class="toggle">${icon(faArrowDown).node}</div>
                    </div>
                    ${this.expanded ? html`
                        <p><slot></slot></p>
                        <button @click=${this.signClick}>${icon(faPenToSquare).node} Unterschreiben</button>
                    ` : html``}
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