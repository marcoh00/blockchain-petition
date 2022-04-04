import { html, LitElement } from "lit";
import { property } from "lit/decorators.js";
import { ZoKratesProvider , initialize, CompilationArtifacts, Proof } from "zokrates-js";
import { SHA256Hash} from "../../shared/merkle";
import { IPetition } from "../../shared/web3";
import { IDPManager } from "./idp";
import { decorateClassWithState, IState } from "./state";

interface IDualZokratesData {
    points: Proof
    cmdline: string
    hpers: SHA256Hash
}
class ZokratesBase {}
export class ZokratesHelper extends decorateClassWithState(ZokratesBase) {
    provider?: ZoKratesProvider;
    provingKey?: Uint8Array;
    compilationArtifacts?: CompilationArtifacts;

    constructor() {
        super();
    }

    async init() {
        this.initProgress("Initialisiere Beweis-Subsystem");
        this.provider = await initialize();
        this.initProgress("Erstellung des Beweis-Programms");
        this.compilationArtifacts = await this.compile();
        this.initProgress("Herunterladen des kryptografischen Schlüssels");
        await this.download_pk();
        this.initProgress(undefined, true);
    }

    initProgress(text: string = undefined, done: boolean = false) {
        this.setState({
            ...this.getState(),
            lockspinner: !done,
            locktext: text
        });
    }


    async jsProof(rt: number[], hpers: number[], pid: number[], priv: number[], pub: number[], directionSelector: number[], merkle: number[][]): Promise<Proof> {
        // compilation
        console.log("artifacts", this.compilationArtifacts);
        // Key
        console.log("key", this.provingKey);
        this.initProgress("Gültige Eingabeparameter bestimmen");
        // computation
        const { witness, output } = this.provider.computeWitness(
            this.compilationArtifacts,
            [
                rt.map(n => n.toString()),
                hpers.map(n => n.toString()),
                pid.map(n => n.toString()),
                priv.map(n => n.toString()),
                pub.map(n => n.toString()),
                directionSelector.map(n => n == 0 ? false : true),
                merkle.map(a => a.map(n => n.toString()))
            ]
        );
        console.log("witness, output", witness,  output);


        // generate proof
        this.initProgress("Unterschriftsbeweis erzeugen");
        const proof = this.provider.generateProof(this.compilationArtifacts.program, witness, this.provingKey);
        console.log("proof", proof);
        return proof;
    }

    hexStringToDecimalArray(hexString: string, bytesPerNumber: number): number[] {
        const hexCharsPerDecimal = 2 * bytesPerNumber;
        if(hexString.length % hexCharsPerDecimal !== 0) throw Error(`Incorrect length of hex string (len=${hexString.length}, hexCharsPerDecimal=${hexCharsPerDecimal})`);

        const intArray: number[] = [];
        for (let i = 0; i < hexString.length; i += hexCharsPerDecimal) {
            intArray.push(Number.parseInt(hexString.substring(i, i + hexCharsPerDecimal), 16));
        }
        return intArray;
    }

    
    //rt, H_pers, pID, Kpriv, Kpub, directionSelector(bool 3), merkleproof(3*8)
    async constructProof(petition: IPetition, idp: IDPManager): Promise<IDualZokratesData> {
        this.initProgress("Persönliche Kennzahl errechnen");
        const credentials = idp.getRegistrationData(petition.period);
        // Calculate hPers
        const pers = [
            ...Array.from(petition.id),
            ...Array.from(credentials.privkey.rawValue())
        ];
        console.log("pers", pers);
        const hpers = await SHA256Hash.hashRaw(new Uint8Array(pers));

        const rt = idp.getRegistrationData(petition.period).credentials.hash;
        console.log("rt", rt);
        console.log("hpers", hpers);
        console.log("pID", petition.id);
        console.log("Kpriv", credentials.privkey);
        console.log("Kpub", credentials.pubkey);
        console.log("directionSelector", credentials.credentials.proof.directionSelector);
        console.log("merklePath", credentials.credentials.proof.path);

        const rt_out = this.hexStringToDecimalArray(rt, 4);
        console.log("rt-out", rt_out);
        const hpers_out = this.hexStringToDecimalArray(hpers.toHex(), 4);
        console.log("hpers-out", hpers_out);
        const pid_out = this.hexStringToDecimalArray(Buffer.from(petition.id).toString('hex'), 4);
        console.log("pID-out", pid_out);
        const priv_out = this.hexStringToDecimalArray(credentials.privkey.toHex(), 4);
        console.log("Kpriv-out", priv_out);
        const pub_out = this.hexStringToDecimalArray(credentials.pubkey.toHex(), 4);
        console.log("Kpub-out", pub_out);

        const directionSelectorDecimalArray: number[] = credentials.credentials.proof.directionSelector.map(b => b ? 1 : 0);
        console.log("direction-Selector-out", directionSelectorDecimalArray);

        const merklePathDecimalArray: number[][] = credentials.credentials.proof.path.map(hash => this.hexStringToDecimalArray(hash, 4));
        console.log("merklePath-out", merklePathDecimalArray)

        const zokratesbeweisInput = ZokratesHelper.cmdProof(rt_out, hpers_out, pid_out, priv_out, pub_out, directionSelectorDecimalArray, merklePathDecimalArray);
        console.log("Zokratesbeweisinput", zokratesbeweisInput);

        const data: IDualZokratesData = {
            cmdline: zokratesbeweisInput,
            hpers,
            points: await this.jsProof(rt_out, hpers_out, pid_out, priv_out, pub_out, directionSelectorDecimalArray, merklePathDecimalArray)
        };
        this.initProgress(undefined, true);
        return data;
    }

    static cmdProof(rt: number[], hpers: number[], pid: number[], priv: number[], pub: number[], directionSelector: number[], merkle: number[][]): string {
        return `zokrates compute-witness --input stimmrechtsbeweis -a `
            + `${rt.join(" ")} ${hpers.join(" ")} ${pid.join(" ")} ${priv.join(" ")} ${pub.join(" ")} `
            + `${directionSelector.join(" ")} ${merkle.flat().join(" ")} `
            + `&& zokrates generate-proof --input stimmrechtsbeweis && cat proof.json`;
    }

    compile(): Promise<CompilationArtifacts> {
        return new Promise((resolve, reject) => {
            const worker = new Worker(new URL("./compileZokratesWorker.js", import.meta.url));
            worker.onmessage = (e) => resolve(e.data as CompilationArtifacts);
            worker.postMessage(null);
        });
    }

    async download_pk() {
        const url = "http://localhost:65535/proving.key"
        const response = await fetch(url);
        const filesize = Number.parseInt(response.headers.get("content-length"));
        
        const data: number[] = [];
        const reader = response.body.getReader();
        let recv = 0;

        while(true) {
            const read = await reader.read();
            if(read.done) break;
            read.value.forEach(byte => data.push(byte));
            this.initProgress(`Herunterladen: ${data.length}/${filesize} (${((data.length / filesize) * 100).toFixed(1)} %)`);
        }

        this.provingKey = new Uint8Array(data);
    }
}
let helper: ZokratesHelper = null;
export async function getZokratesHelper() {
    if(helper === null) {
        const new_helper = new ZokratesHelper();
        await new_helper.init();
        helper = new_helper;
    }
    console.log("Zokrates helper is initialized, return it", helper);
    return helper;
}

export class ZokratesTester extends decorateClassWithState(LitElement) {
    @property()
    zinit: boolean = false

    @property()
    status?: string

    render() {
        return this.zinit ? html`` : html`
            <button @click=${this.initializeZokrates}>Initialize ZoKrates</button>
            <div class="status">${this.status}</div>
        `;
    }

    async stateChanged(state: IState): Promise<void> {
        this.zinit = state.zokrates.initialized;
        this.status = state.zokrates.text;
    }

    initializeZokrates() {
        getZokratesHelper().then(helper => console.log("helper initialized", helper));
    }
}