import { html, LitElement } from "lit";
import { property } from "lit/decorators.js";
import { ZoKratesProvider, initialize, CompilationArtifacts, Proof, ComputationResult } from "zokrates-js";
import { DataHash, SHA256Hash } from "../../shared/merkle";
import { IPetition } from "../../shared/web3";
import { IDPManager } from "./idp";
import { decorateClassWithState, IState } from "./state";
import { IZKKey, IZKProofResponse } from "./keys";
import { ZKClientProvider } from "./provider";

interface IDualZokratesData {
    points: Proof
    cmdline: string
    hpers: SHA256Hash
}
class ZokratesBase { }
export class ZokratesHelper extends decorateClassWithState(ZokratesBase) {
    provider?: ZoKratesProvider;
    provingKey?: Uint8Array;
    compilationArtifacts?: CompilationArtifacts;
    worker: Worker;
    customurl?: string;

    constructor(worker?: Worker, url?: string) {
        super();
        this.customurl = url;
        this.worker = typeof (worker) === "object" ? worker : new Worker(new URL("./compileZokratesWorker.js", import.meta.url));
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
        console.log(text);
        this.setState({
            ...this.getState(),
            lockspinner: !done,
            locktext: text
        });
    }

    compile(): Promise<CompilationArtifacts> {
        return new Promise((resolve, reject) => {
            this.worker.onmessage = (e) => e.data[0] !== "error" ? resolve(e.data[1] as CompilationArtifacts) : reject(e.data[1]);
            this.worker.postMessage(["compileSource"]);
        });
    }

    computeWitness(artifacts: CompilationArtifacts, args: any[]): Promise<ComputationResult> {
        return new Promise((resolve, reject) => {
            this.worker.onmessage = (e) => e.data[0] !== "error" ? resolve(e.data[1] as ComputationResult) : reject(e.data[1]);
            this.worker.postMessage(["computeWitness", artifacts, args]);
        });
    }

    generateProof(program: Uint8Array, witness: Uint8Array, provingKey: Uint8Array): Promise<Proof> {
        return new Promise((resolve, reject) => {
            this.worker.onmessage = (e) => e.data[0] !== "error" ? resolve(e.data[1] as Proof) : reject(e.data[1]);
            this.worker.postMessage(["jsProof", program, witness, provingKey]);
        });
    }


    async jsProof(rt: number[], hpers: number[], pid: number[], priv: number[], pub: number[], directionSelector: number[], merkle: number[][]): Promise<Proof> {
        // compilation
        console.log("artifacts", this.compilationArtifacts);
        // Key
        console.log("key", this.provingKey);
        this.initProgress("Gültige Eingabeparameter bestimmen");
        // computation
        const { witness, output } = await this.computeWitness(
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
        console.log("witness, output", witness, output);


        // generate proof
        this.initProgress("Unterschriftsbeweis erzeugen");
        const proof = await this.generateProof(this.compilationArtifacts.program, witness, this.provingKey);
        console.log("proof", proof);
        return proof;
    }

    hexStringToDecimalArray(hexString: string, bytesPerNumber: number): number[] {
        const hexCharsPerDecimal = 2 * bytesPerNumber;
        if (hexString.length % hexCharsPerDecimal !== 0) throw Error(`Incorrect length of hex string (len=${hexString.length}, hexCharsPerDecimal=${hexCharsPerDecimal})`);

        const intArray: number[] = [];
        for (let i = 0; i < hexString.length; i += hexCharsPerDecimal) {
            intArray.push(Number.parseInt(hexString.substring(i, i + hexCharsPerDecimal), 16));
        }
        return intArray;
    }


    //rt, H_pers, pID, Kpriv, Kpub, directionSelector(bool 3), merkleproof(3*8)
    async constructProof(petition: IPetition, hpers: DataHash, credentials: IZKKey, proof_parts: IZKProofResponse): Promise<IDualZokratesData> {
        this.initProgress("Persönliche Kennzahl errechnen");
        const rt = proof_parts.hash;
        console.log("rt", rt);
        console.log("hpers", hpers);
        console.log("pID", petition.id);
        console.log("Kpriv", credentials.privkey);
        console.log("Kpub", credentials.pubkey);
        console.log("directionSelector", proof_parts.proof.directionSelector);
        console.log("merklePath", proof_parts.proof.path);

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

        const directionSelectorDecimalArray: number[] = proof_parts.proof.directionSelector.map(b => b ? 1 : 0);
        console.log("direction-Selector-out", directionSelectorDecimalArray);

        const merklePathDecimalArray: number[][] = proof_parts.proof.path.map(hash => this.hexStringToDecimalArray(hash, 4));
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

    async download_pk() {
        // url_zk() call
        const url = typeof (this.customurl) === "string" && this.customurl !== "" ? this.customurl : `${await this.getState().connector.connector.url()}/proving.key`;
        const response = await fetch(url);
        const filesize = Number.parseInt(response.headers.get("content-length"));

        const data: number[] = [];
        const reader = response.body.getReader();
        let recv = 0;

        while (true) {
            const read = await reader.read();
            if (read.done) break;
            read.value.forEach(byte => data.push(byte));
            this.initProgress(`Herunterladen: ${data.length}/${filesize} (${((data.length / filesize) * 100).toFixed(1)} %)`);
        }

        this.provingKey = new Uint8Array(data);
    }
}
