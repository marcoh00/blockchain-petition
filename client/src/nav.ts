import { LitElement, html, css } from 'lit';
import { property } from 'lit/decorators.js';
import { decorateClassWithState, IState } from './state';
import { basicFlex, buttonMixin, colorfulBar, faStyle, leftRightFlex } from './styles';
import { icon } from '@fortawesome/fontawesome-svg-core';
import { faAddressCard, faChevronLeft, faChevronRight, faCircleXmark, faClock, faCross, faQuestionCircle, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { faEthereum } from '@fortawesome/free-brands-svg-icons';
import { IDPManager } from './idp';

export class InformationalInfobar extends LitElement {
    static styles = [faStyle, basicFlex, leftRightFlex, buttonMixin, colorfulBar,
        css`
            :host {
                justify-content: space-between;
                padding: 1rem 2rem;
                height: 5rem;
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
    static styles = [faStyle, basicFlex, leftRightFlex, buttonMixin, colorfulBar,
        css`
            :host {
                justify-content: space-between;
                padding: 1rem 2rem;
                height: 5rem;
            }
            a {
                font-size: 0.8em;
                color: #faffdb;
            }
            period-widget {
                width: 30vw;
                max-width: 230px;
            }
            idp-widget {
                width: 42vw;
                max-width: 300px;
            }
        `];
    render() {
        return html`
            <a href="#" @click=${() => this.dispatchEvent(new CustomEvent("pageClick", { bubbles: true, detail: "main" }))}>Petitionen anzeigen</a>
            <a href="#" @click=${() => this.dispatchEvent(new CustomEvent("pageClick", { bubbles: true, detail: "create" }))}>Petition erstellen</a>
            <period-widget></period-widget>
            <idp-widget></idp-widget>
        `;
    }
}

export class PeriodWidget extends decorateClassWithState(LitElement) {
    static styles = [faStyle, css`
        .grid {
            display: grid;
            grid-template-areas:
                "larr nana  descr nanc"
                "larr clock descr rarr"
                "larr nanb  descr nand";
            grid-template-columns: 1fr 2fr 6fr 1fr;
            grid-template-rows: 1fr 2fr 1fr;
            justify-items: stretch;
            align-items: center;
            justify-content: center;
            align-content: start;
        }
        .icon {
            grid-area: clock;
            display: flex;
            flex-direction: row nowrap;
            justify-content: center;
            align-items: center;

        }
        .icon > svg {
            height: 1.3em;
        }
        .larr {
            grid-area: larr;
            display: flex;
            flex-direction: row nowrap;
            justify-content: center;
            align-items: center;
        }
        .larr > svg {
            height: 1.3em;
        }
        .rarr {
            grid-area: rarr;
            display: flex;
            flex-direction: row nowrap;
            justify-content: center;
            align-items: center;
        }
        .rarr > svg {
            height: 1.3em;
        }
        .text {
            grid-area: descr;
        }
        .info {
            font-size: 0.5em;
        }
        .clickable {
            cursor: pointer;
        }
    `];
    @property()
    period: number = -1

    @property()
    ts_from?: Date

    @property()
    ts_until?: Date

    render() {
        return html`
        <div class="grid">
            <div class="larr clickable" @click=${this.periodBackClick}>
                ${icon(faChevronLeft).node}
            </div>
            <div class="logo icon clickable" @click=${this.periodResetClick}>
                ${icon(faClock).node}
            </div>
            <div class="info text">
                <div class="periodno">
                 Wahlperiode: ${this.period <= 0 ? html`
                        Unbekannt
                    ` : html`
                        ${this.period}
                    `}
                </div>
                ${this.period <= 0 ? html`` : html`
                    <div class="timespan">
                        <div class="tsfrom">
                            Von ${PeriodWidget.dateToDisplayString(this.ts_from)}
                        </div>
                        <div class="tsuntil">
                            bis ${PeriodWidget.dateToDisplayString(this.ts_until)}
                        </div>
                    </div>
                `}
            </div>
            <div class="rarr clickable" @click=${this.periodNextClick}>
                ${icon(faChevronRight).node}
            </div>
        </div>`;
    }

    periodBackClick() {
        this.setState({
            ...this.getState(),
            period: this.period - 1,
            customPeriod: true
        });
    }

    periodNextClick() {
        this.setState({
            ...this.getState(),
            period: this.period + 1,
            customPeriod: true
        });
    }

    periodResetClick() {
        const state = this.getState();
        this.setState({
            ...state,
            period: state.repository.period,
            customPeriod: false
        });
    }

    async stateChanged(state: IState) {
        if (typeof (state.repository) === "object") {
            this.period = state.period;
            if (this.period > 0) {
                await state.repository.addToTimeCacheIfNeccessary(this.period);
                this.ts_from = state.repository.period_time_cache[this.period].start;
                this.ts_until = state.repository.period_time_cache[this.period].end;
            }
        }
    }

    static dateToDisplayString(d: Date) {
        if (d === undefined) {
            return "-1";
        }
        let year = d.getFullYear();
        let month = d.getMonth() + 1; // Zero-indexed
        let day = d.getDate();
        let hour = d.getHours();
        let minute = d.getMinutes();

        const make2digits = (n: number) => n > 9 ? n.toString() : `0${n.toString()}`;
        let [syear, smonth, sday, shour, sminute] = [year, month, day, hour, minute].map(make2digits);
        return `${sday}.${smonth}.${syear} ${shour}:${sminute}`
    }
}

export class IDPWidget extends decorateClassWithState(LitElement) {
    static styles = [faStyle, buttonMixin, css`
        .grid {
            display: grid;
            grid-template-areas:
                "ic ident ident"
                "ic msg   symb";
            grid-template-columns: 1fr 3fr 1fr;
            grid-template-rows: 1fr 1fr;
            justify-items: stretch;
            align-items: center;
            justify-content: center;
            align-content: start;
            gap: 0.5em;
        }
        .logo {
            grid-area: ic;
            display: flex;
            flex-direction: row nowrap;
            justify-content: center;
            align-items: center;
            margin-right: 0.1em;

        }
        .isymb {
            display: flex;
            flex-direction: row nowrap;
            justify-content: center;
            align-items: center;
        }
        .logo > svg {
            height: 1.3em;
        }
        .identity {
            grid-area: ident;
            font-size: 0.5em;
            font-weight: bold;
        }
        .symb {
            grid-area: symb;
        }
        .text {
            grid-area: msg;
            font-size: 0.5em;
        }
        loading-spinner {
            width: 16px;
            height: 16px;
        }
    `];

    @property({ type: Object })
    idpmanager: IDPManager

    @property()
    working: boolean = false;

    @property()
    failed: boolean = false;

    @property()
    stage: number = 0;

    connectedCallback(): void {
        super.connectedCallback();
        this.stateChanged(this.getState());
    }

    render() {
        return this.stage < 1 ? html`Keine Identität festgelegt` : html`
            <div class="grid">
                <div class="logo">
                    ${icon(faAddressCard).node}
                </div>
                <div class="identity">
                    ${this.idpmanager.identity}
                </div>
                <div class="symb">
                    <div class="isymb">
                        ${this.working ? html`<loading-spinner .border=1em></loading-spinner>` : html``}
                        ${this.failed ? html`<div>${icon(faCircleXmark).node}</div>` : html``}
                   </div>
                </div>
                <div class="text">
                    ${this.stateText()}
                </div>
            </div>
        `;
    }

    stateText() {
        console.log("Calc state", this);
        if (this.failed) return html`<button @click=${this.obtainProofClick}>Erneut versuchen</button>`
        if (this.working) {
            switch (this.stage) {
                case 1:
                    return html`<span>1/3 Token</span>`;
                case 2:
                    return html`<span>2/3 Warte auf Blockchain</span>`;
                case 3:
                    return html`<span>3/3 Abschluss</span>`;
            }
        }
        switch (this.stage) {
            case 1:
                return html`<button @click=${this.obtainProofClick}>Identitätsnachweis beantragen</button>`;
            case 2:
                return html`<button @click=${this.obtainProofClick}>Identitätsnachweis beantragen</button>`;
            case 3:
                return html`<span>OK</span>`;
        }
        throw new Error("Unreachable");
    }

    async stateChanged(state: IState): Promise<void> {
        this.idpmanager = state.idp;
        this.stage = 0;
        if (typeof (this.idpmanager) === "object") {
            this.stage += 1;
            const regdata = this.idpmanager.registration_data(state.period);
            this.working = regdata.working;
            this.failed = regdata.failed;
            if (typeof (regdata.token) === "string") this.stage += 1;
            if (typeof (regdata.response) === "object") this.stage += 1;
        }
    }

    async obtainProofClick() {
        const period = this.getState().period;
        console.log(`Obtain credentials for period ${period}`);
        try {
            await this.getState().keymanager.get_proof(period, true);
        } catch (e) {
            console.trace(e);
            this.stateError(`Unable to obtain proof of identity: ${e}`);
        }
    }
}