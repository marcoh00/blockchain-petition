import { html, LitElement } from "lit";
import { property, query } from 'lit/decorators.js';
import { IPetition } from "../../shared/web3";
import { IClientProvider } from "./provider";

function generatePetition(): IPetition {
    const petition_id = new Uint8Array(32);
    crypto.getRandomValues(petition_id);
    return {
        address: "0x0",
        id: petition_id
    } as IPetition;
}

export async function measurePerformance(provider: IClientProvider, keep_running: (run: number) => boolean, save: (runs: number, time: number) => void): Promise<void> {
    // One for warmup
    await provider.sign(generatePetition(), false);

    let runs = 0;
    const start_time = performance.now();
    while (keep_running(runs)) {
        const petition = generatePetition();
        await provider.sign(petition, false);
        runs++;
    }
    const end_time = performance.now();
    const total_time = end_time - start_time;
    console.log(`${runs} runs took ${total_time} ms`);
    save(runs, total_time);
}

function setSampleData(alg: string, ty: string, box: HTMLTextAreaElement) {
    const should_fill = true; //typeof (box.value) !== "string" || box.value === "";
    const fill_with = sampleDataFor(alg, ty);
    const can_fill = typeof (fill_with) === "string";
    if (should_fill && can_fill) {
        box.value = fill_with;
    }
}

function sampleDataFor(alg: string, ty: string): string | null {
    switch (ty) {
        case "key":
            return keyDataFor(alg);
        case "connector":
            return connectorDataFor(alg);
    }
    return null;
}

export class PerfMeasure extends LitElement {
    @property()
    perf_running: boolean;

    @property()
    runs: number;

    @property()
    time: number;

    @property()
    status: number;

    @property()
    selected_algo: string = "zk";

    render() {
        return html`
            <div class="inputelems">
                IDP Data: <textarea id="key_data"></textarea>
                Connector data: <textarea id="connector_data">{}</textarea>

                <select id="algorithm" @change=${this.newAlgo}>
                    <option value="zk">ZoKrates</option>
                    <option value="psssecp256k1">PSS-SECP256K1</option>
                    <option value="pssaltbn128">PSS-ALTBN128</option>
                    <option value="semaphore">Semaphore</option>
                </select>

                Maximum Runtime (s):
                <input type="number" id="maxtime" value="600000">

                Maximum tries:
                <input type="number" id="maxruns" value="1000">

                <input type="submit" @click=${this.toggleRun}>

            </div>

            <div class="statuselems">
                <p>Status: ${this.status}</p>
                <p>Runs: ${this.runs}</p>
                <p>Time: ${this.time}</p>
            </div>
        `;
    }

    newAlgo(e: Event) {
        const previously_selected = this.selected_algo;
        const select_elem = this.renderRoot?.querySelector("#algorithm") as HTMLSelectElement;
        this.selected_algo = select_elem.options[select_elem.selectedIndex].value;
        console.log(this.selected_algo);

        const key = this.renderRoot?.querySelector("#key_data") as HTMLTextAreaElement;
        const connector = this.renderRoot?.querySelector("#connector_data") as HTMLTextAreaElement;

        if (previously_selected !== this.selected_algo) {
            setSampleData(this.selected_algo, "key", key);
            setSampleData(this.selected_algo, "connector", connector);
        }
    }

    toggleRun(e: Event) {
        const key = (this.renderRoot?.querySelector("#key_data") as HTMLTextAreaElement).value;
        const connector = (this.renderRoot?.querySelector("#connector_data") as HTMLTextAreaElement).value;

        const select_elem = this.renderRoot?.querySelector("#algorithm") as HTMLSelectElement;
        const selected = select_elem.options[select_elem.selectedIndex].value;

        const maxtime = (this.renderRoot?.querySelector("#maxtime") as HTMLInputElement).valueAsNumber;
        const maxruns = (this.renderRoot?.querySelector("#maxruns") as HTMLInputElement).valueAsNumber;

        const worker = new Worker(new URL("./perfWorker.js", import.meta.url));
        worker.onmessage = (e) => this.handleWorkerMsg(e);
        worker.postMessage([key, connector, selected, maxtime, maxruns]);

        console.log(key, connector, selected, maxtime, maxruns, this.selected_algo);
    }

    handleWorkerMsg(e: any) {
        this.status = e.data[0];
        this.runs = e.data[1];
        this.time = e.data[2];
    }
}

function keyDataFor(alg: string): string | null {
    switch (alg) {
        case "zk":
            return '{"96333":{"keys":{"privkey":"7e94400ea2eeeafdefd1fac7330f0b302a4d03b6c4c44164d090f8468ad7d838","pubkey":"43d1ee2bdaecd0c96415c700cfafe533769b9b3b217f181181aba142f0d00976"},"proof":{"hash":"738a1791ffe1b814635bf77ec5c1b1c4f6d73a98ad0c1f92459ac5e9f2c7752a","iteration":2,"period":96333,"proof":{"directionSelector":[false,false,false],"path":["ce814b9b239c3f119578649ac62053d7cae5d7cc4718a785249f89692244ae58","427eb99366291fa48e3d0e31e5b1648fd357a9b8c43729cb1d3cee2afc5e0c94","4de2b1009349cfaee300153e4a4ba9b6561eaa106022383b92660b70d075f3bf"]}}}}';
        case "psssecp256k1":
            return '{"1":{"keys":{},"proof":{"hash":"asdfsadfasdf","iteration":1,"period":1,"proof":{"sk_icc_1_u":[148,215,123,224,160,208,183,158,200,59,124,228,166,71,230,17,218,234,63,49,102,137,131,118,237,106,100,103,24,134,43,175],"sk_icc_2_u":[94,130,153,89,165,218,182,81,0,161,65,64,21,186,105,29,138,141,52,158,163,69,137,143,244,42,69,8,201,63,10,222],"algorithm":"secp256k1"}}}}';
        case "pssaltbn128":
            return '{"1":{"keys":{},"proof":{"hash":"00aaa00","iteration":1,"period":1,"proof":{"sk_icc_1_u":[28,92,173,32,57,12,84,66,161,141,191,73,21,56,180,49,109,199,142,241,6,110,108,51,234,68,69,2,177,120,253,61],"sk_icc_2_u":[14,131,174,144,253,161,112,133,200,88,134,104,247,197,26,1,48,50,188,64,98,23,240,187,31,78,21,69,93,145,53,241],"algorithm":"alt-bn128"}}}}';
        case "semaphore":
            return '{"1":{"keys":"YlPaROqCL3Fb4Rdo3/bn9rI0Czb7FY6SFZQ6uKSYFoE=","proof":"{\\"hash\\":\\"9321479870032571154948240897608207261565522816726117704329258959011709185345\\",\\"iteration\\":1,\\"period\\":1,\\"proof\\":\\"{\\\\\\"merkle\\\\\\":{\\\\\\"root\\\\\\":\\\\\\"5236423637350896201024375441014385578144409243898895509846150151780512101903\\\\\\",\\\\\\"depth\\\\\\":\\\\\\"1\\\\\\",\\\\\\"size\\\\\\":\\\\\\"2\\\\\\"},\\\\\\"members\\\\\\":[\\\\\\"11101548872786322397149231438145147363842281686546688474123627199222884704172\\\\\\",\\\\\\"9321479870032571154948240897608207261565522816726117704329258959011709185345\\\\\\"]}\\"}"}}';
    }
    return null;
}

function connectorDataFor(alg: string): string | null {
    switch (alg) {
        case "zk":
            return null;
        case "psssecp256k1":
            return '{"sk_m": [176, 64, 49, 15, 66, 68, 176, 35, 252, 196, 158, 14, 166, 147, 59, 228, 252, 162, 195, 2, 175, 222, 31, 143, 115, 38, 90, 96, 251, 3, 247, 193], "pk_m": [4, 92, 103, 172, 246, 205, 133, 43, 29, 59, 83, 65, 129, 99, 219, 17, 46, 75, 191, 9, 98, 73, 127, 198, 106, 174, 14, 177, 227, 149, 2, 24, 223, 40, 244, 241, 24, 162, 59, 186, 189, 75, 22, 247, 95, 195, 29, 157, 140, 75, 18, 227, 68, 143, 5, 156, 64, 20, 115, 213, 47, 216, 103, 95, 171], "pk_m_x": "5c67acf6cd852b1d3b53418163db112e4bbf0962497fc66aae0eb1e3950218df", "pk_m_y": "28f4f118a23bbabd4b16f75fc31d9d8c4b12e3448f059c401473d52fd8675fab", "sk_icc": [253, 20, 153, 47, 70, 222, 96, 129, 151, 210, 181, 224, 29, 177, 178, 45, 17, 70, 255, 69, 144, 185, 179, 128, 142, 82, 173, 77, 153, 29, 50, 23], "pk_icc": [4, 234, 121, 231, 8, 157, 150, 251, 254, 0, 191, 251, 83, 39, 100, 91, 63, 44, 228, 217, 1, 120, 189, 183, 176, 85, 84, 250, 111, 195, 108, 15, 25, 79, 204, 20, 70, 43, 209, 220, 180, 135, 27, 195, 37, 231, 19, 99, 46, 55, 66, 157, 191, 52, 207, 74, 235, 110, 180, 101, 128, 100, 182, 209, 178], "pk_icc_x": "ea79e7089d96fbfe00bffb5327645b3f2ce4d90178bdb7b05554fa6fc36c0f19", "pk_icc_y": "4fcc14462bd1dcb4871bc325e713632e37429dbf34cf4aeb6eb4658064b6d1b2", "sectors": [{"pk_sector": [4, 107, 90, 212, 140, 137, 106, 131, 127, 211, 23, 3, 67, 114, 11, 76, 132, 56, 100, 231, 35, 102, 85, 53, 243, 158, 216, 200, 27, 153, 45, 13, 74, 127, 73, 131, 129, 97, 158, 40, 224, 249, 245, 174, 141, 125, 203, 23, 135, 28, 158, 112, 8, 93, 169, 249, 38, 107, 241, 228, 251, 117, 62, 144, 151], "pk_sector_x": "6b5ad48c896a837fd3170343720b4c843864e723665535f39ed8c81b992d0d4a", "pk_sector_y": "7f498381619e28e0f9f5ae8d7dcb17871c9e70085da9f9266bf1e4fb753e9097"}], "algorithm": "secp256k1"}';
        case "pssaltbn128":
            return '{"sk_m": [33, 28, 51, 4, 150, 249, 19, 243, 102, 163, 56, 155, 75, 143, 74, 85, 182, 209, 33, 12, 236, 96, 231, 254, 158, 168, 0, 200, 28, 149, 152, 58], "pk_m": [4, 33, 175, 66, 182, 190, 23, 38, 176, 128, 100, 2, 160, 121, 98, 141, 122, 22, 96, 190, 41, 212, 178, 227, 165, 219, 40, 22, 44, 208, 232, 39, 68, 39, 164, 5, 157, 232, 71, 159, 147, 175, 51, 178, 36, 154, 160, 218, 141, 193, 76, 119, 220, 206, 10, 127, 34, 200, 131, 232, 106, 91, 157, 173, 231], "pk_m_x": "21af42b6be1726b0806402a079628d7a1660be29d4b2e3a5db28162cd0e82744", "pk_m_y": "27a4059de8479f93af33b2249aa0da8dc14c77dcce0a7f22c883e86a5b9dade7", "sk_icc": [19, 64, 204, 105, 72, 231, 221, 137, 88, 169, 38, 168, 107, 37, 242, 156, 176, 224, 135, 79, 42, 52, 149, 127, 231, 114, 169, 145, 1, 36, 182, 166], "pk_icc": [4, 20, 167, 255, 252, 187, 141, 246, 82, 65, 18, 23, 119, 153, 180, 87, 0, 155, 207, 14, 157, 211, 41, 88, 145, 225, 47, 100, 177, 70, 153, 143, 134, 37, 140, 242, 197, 120, 156, 76, 11, 115, 5, 71, 245, 132, 164, 242, 46, 90, 203, 90, 228, 222, 228, 84, 207, 73, 97, 203, 129, 35, 108, 127, 166], "pk_icc_x": "14a7fffcbb8df6524112177799b457009bcf0e9dd3295891e12f64b146998f86", "pk_icc_y": "258cf2c5789c4c0b730547f584a4f22e5acb5ae4dee454cf4961cb81236c7fa6", "sectors": [{"pk_sector": [4, 3, 18, 223, 166, 80, 14, 45, 110, 11, 29, 133, 178, 76, 115, 197, 110, 115, 132, 1, 144, 81, 91, 149, 255, 220, 106, 120, 243, 221, 23, 180, 168, 16, 21, 66, 154, 38, 111, 37, 22, 15, 104, 105, 21, 88, 53, 71, 114, 159, 90, 42, 106, 214, 175, 14, 230, 215, 116, 96, 2, 39, 164, 211, 6], "pk_sector_x": "0312dfa6500e2d6e0b1d85b24c73c56e73840190515b95ffdc6a78f3dd17b4a8", "pk_sector_y": "1015429a266f25160f686915583547729f5a2a6ad6af0ee6d774600227a4d306"}], "algorithm": "alt-bn128"}';
        case "semaphore":
            return null;
    }
    return null;
}

