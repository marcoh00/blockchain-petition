import { LitElement, html, css } from 'lit';
import { property } from 'lit/decorators.js';
import { decorateClassWithState, IState } from './state';
import { basicFlex, buttonMixin, colorfulBar, faStyle, leftRightFlex } from './styles';
import { icon } from '@fortawesome/fontawesome-svg-core';
import { faChevronLeft, faChevronRight, faClock, faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { faEthereum } from '@fortawesome/free-brands-svg-icons';

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

            period-widget {
                flex-grow: 2;
            }
        `];
    render() {
        return html`
            <a href="#">Petitionen anzeigen</a>
            <a href="#">Petition erstellen</a>
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
            grid-template-columns: 1fr 2fr 4fr 1fr;
            grid-template-rows: 1fr 1fr 1fr;
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
            <div class="larr">
                ${icon(faChevronLeft).node}
            </div>
            <div class="logo icon">
                ${icon(faClock).node}
            </div>
            <div class="info text">
                <div class="periodno">
                    ${this.period <= 0 ? html`
                        Unbekannt
                    ` : html`
                        ${this.period}
                    `}
                </div>
                ${this.period <= 0 ? html`` : html`
                    <div class="timespan">
                        <div class="tsfrom">
                            ${PeriodWidget.dateToDisplayString(this.ts_from)}
                        </div>
                        <div class="tsuntil">
                            bis ${PeriodWidget.dateToDisplayString(this.ts_until)}
                        </div>
                    </div>
                `}
            </div>
            <div class="rarr">
                ${icon(faChevronRight).node}
            </div>
        </div>`;
    }

    async stateChanged(state: IState) {
        if(typeof(state.repository) === "object") {
            this.period = state.repository.period;
            if(this.period > 0) {
                state.repository.addToTimeCacheIfNeccessary(this.period);
                this.ts_from = state.repository.period_time_cache[this.period].start;
                this.ts_until = state.repository.period_time_cache[this.period].end;
            }
        }
    }

    static dateToDisplayString(d: Date) {
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