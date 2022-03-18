import { icon } from '@fortawesome/fontawesome-svg-core';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { LitElement, html, css, CSSResultGroup } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { REGISTRY_CONTRACT } from '../../shared/addr';
import { decorateClassWithState, IState } from './state';
import { basicFlex, buttonMixin, faStyle, topDownFlex } from './styles';

export class LandingPage extends LitElement {
    static styles = [basicFlex, topDownFlex, buttonMixin, css`
        :host {
            align-items: center;
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
    static styles = [faStyle, basicFlex, topDownFlex, buttonMixin, css`
        :host {
            align-items: center;
        }`];
    
    render() {
        return html`
            <span><h1>Wählen Sie eine Registrierungsstelle ${icon(faQuestionCircle).node}</h1></span>
            <registry-chooser @registryClick=${this.registryClick}></registry-chooser>
        `;
    }

    registryClick(e: CustomEvent) {}
}

export class RegistryChooser extends LitElement {
    static styles = [basicFlex, topDownFlex, css`
    :host {
        align-items: center;
    }

    .entry {
        display: grid;
        grid-template-areas:
            "cb descr descr descr ident"
            "cb descr descr descr ident"
            "cb sdesc sdesc sdesc ident";
        grid-template-columns: repeat(5, 15vw);
        grid-template-rows: 1fr 1fr 1fr;
        justify-items: stretch;
        align-items: center;
        justify-content: stretch;
        align-content: start;
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
    }

    input[type=radio] {
        width: 100%;
        min-height: 30px;
    }
    `];

    @property({type: Object})
    registries: any[] = [
        {
            addr: REGISTRY_CONTRACT,
            descr: "Petitionen der Verbraucherzentrale NRW",
            ident: "Personalausweis"
        },
        {
            addr: "0xb3Aff715Cf9d2D9a65F0992F93777Ccf3c7fa6e0",
            descr: "change.org Blockchain-Petitionen",
            ident: "E-Mail"
        }];

    @property({type: String})
    selected = REGISTRY_CONTRACT

    render() {
        return html`
            ${this.registries.map(registry => html`
                <div class="entry">
                    <div class="acheckbox">
                        <input type="radio" id="defreg" name="selector">
                    </div>
                    <div class="adescr">
                        ${registry.descr}
                    </div>
                    <div class="asdesc">
                        ${registry.addr}
                    </div>
                    <div class="aident">
                        ${registry.ident}
                    </div>
                </div>
            `)}
        `;
    }
}