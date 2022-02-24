import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { SHA256Hash } from '../../shared/merkle';

export class KeyGenerator extends LitElement {
    static styles = css`
        .layout {
            display: flex;
            flex-flow: column wrap;
            justify-content: center;
        }
        .descr {
            flex-basis: 30%;
        }
        .main {
            flex-basis: 60%;
        }
    `;

    @property()
    pubkey: string
    
    @property()
    privkey: string

    @property()
    privstring: string

    @property()
    identity: string;

    @property()
    period: number;

    constructor() {
        super();
        this.identity = "";
        this.period = 0;
    }

    render() {
        return html`
            <div class="layout">
                <div class="descr">
                Identity
                </div>
                <div class="main">
                <input type="text" @input=${this.valueChange} id="identity" placeholder="Identity">
                </div>
                <div class="descr">
                Period
                </div>
                <div class="main">
                <input type="number" @input=${this.valueChange} id="period" placeholder="305000">
                </div>
                <div class="descr">
                Privkey (String)
                </div>
                <div class="main">
                ${this.privstring}
                </div>
                <div class="descr">
                Privkey (h(privstring))
                </div>
                <div class="main">
                ${this.privkey}
                </div>
                <div class="descr">
                Pubkey (h(h(privstring)))
                </div>
                <div class="main">
                ${this.pubkey}
                </div>
            </div>
        `;
    }

    async valueChange(e: InputEvent) {
        const target = e.target as HTMLInputElement;
        if(target.id === "identity") {
            this.identity = target.value;
        }
        if(target.id === "period") {
            this.period = Number.parseInt(target.value);
        }

        this.privstring = `${this.period}||${this.identity}`;
        const privstring_hash = await SHA256Hash.hashString(this.privstring);

        this.privkey = `${privstring_hash.toHex()}`;
        this.pubkey = `${(await SHA256Hash.hashRaw(privstring_hash.rawValue())).toHex()}`;
        console.log(target.id, target.value, target);
    }
}