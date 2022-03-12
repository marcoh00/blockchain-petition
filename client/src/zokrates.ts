import { html, LitElement } from "lit";
import { property } from "lit/decorators.js";
import { ZoKratesProvider , initialize } from "zokrates-js";
import { SHA256Hash} from "../../shared/merkle";
import { decorateClassWithState, IState } from "./state";

class ZokratesHelper {
    provider: ZoKratesProvider;
    constructor() {}
    async init() {
        this.provider = await initialize();
    }

    testApp(args: any[]) {
        const source = "import \"hashes/sha256/256bitPadded\" as hash\n" +
            "import \"hashes/sha256/512bitPadded\" as hash_concat\n" +
            "\n" +
            "const u32 DEPTH = 3\n" +
            "\n" +
            "def select(bool condition, u32[8] left, u32[8] right) -> (u32[8], u32[8]):\n" +
            "    return if condition then right else left fi, if condition then left else right fi\n" +
            "\n" +
            "def merkleProofValidation(u32[8] merkleRoot, u32[8] leaf, bool[DEPTH] directionSelector, u32[DEPTH][8] path) -> bool:\n" +
            "    // Start from the leaf\n" +
            "    u32[8] digest = leaf\n" +
            "\n" +
            "    // Loop up the tree\n" +
            "    for u32 i in 0..DEPTH do\n" +
            "        u32[8] left, u32[8] right = select(directionSelector[i], digest, path[i])\n" +
            "        digest = hash_concat(left, right)\n" +
            "    endfor\n" +
            "\n" +
            "    return digest == merkleRoot\n" +
            "\n" +
            "\n" +
            "\n" +
            "def main(public u32[8] rt, public u32[8] H_pers, public u32[8] ID_Petition, private u32[8] K_priv, private u32[8] K_pub, private bool[DEPTH] directionSelector,  private u32[DEPTH][8] merkleproof):\n" +
            "    //K_priv ist Urbild von  K_pub\n" +
            "    assert(K_pub == hash(K_priv))\n" +
            "\n" +
            "    //H_pers wurde korrekt berechnet\n" +
            "    assert(H_pers == hash_concat(ID_Petition,K_priv))\n" +
            "\n" +
            "    //rt enthält K_pub\n" +
            "    assert(merkleProofValidation(rt, K_pub, directionSelector, merkleproof))\n" +
            "\n" +
            "    return\n";


        //Proving Key auslesen
        //const pk = new Uint8Array(fs.readFileSync('../zk/proving.key'));
        //console.log("pk", pk)

        // compilation
        const artifacts = this.provider.compile(source);
        console.log("artifacts", artifacts);

        //rt, H_pers, pID, Kpriv, Kpub, directionSelector(bool 3), merkleproof(3*8)

        //this.privstring = `${this.period}||${this.identity}`;
        //const privstring_hash = await SHA256Hash.hashString(this.privstring);

        const rt = "07929bb1a84881a24ef6f8c575b4a667d024766576024ad1a02f8b4c450e625b";

        // computation
        const { witness, output } = this.provider.computeWitness(artifacts, args);
        //console.log("witness, output", witness,  output);

        //Überspringe, da Schlüsselmaterial importiert wird
        // run setup
        //const keypair = zokratesProvider.setup(artifacts.program);
        //console.log("keypair", keypair);

        // generate proof
        //const proof = this.provider.generateProof(artifacts.program, witness, pk);
        //console.log("proof", proof);

        //schreibe proof in eine Datei
        // fs.writeFile("zokrates-repo/proof.json", JSON.stringify(proof), err=>{
        //     if(err){
        //         console.log("Error writing file" ,err)
        //     } else {
        //         console.log('JSON data is written to the file successfully')
        //     }
        // })

        //unnötig hier
        // export solidity verifier
        //const verifier = zokratesProvider.exportSolidityVerifier(keypair.vk, "v1");
        //console.log("verifier", verifier);
    }
}

export async function getZokratesHelper() {
    const helper = new ZokratesHelper();
    await helper.init();
    return helper;
}

export class ZokratesTester extends decorateClassWithState(LitElement) {
    @property()
    helper?: ZokratesHelper;

    render() {
        return typeof(this.helper) === "object" ? html`
            <button @click=${this.constructProof}>Construct Proof</button>
        ` : html`
            <button @click=${this.initializeZokrates}>Initialize ZoKrates</button>
        `;
    }

    initializeZokrates() {
        getZokratesHelper().then(helperClass => this.helper = helperClass);
    }

    hexStringToDecimalStringArray(hexString: string) {
        const intString:string[] = [];
        for (let i = 0; i < 64; i+=8) {
            //intString.push(parseInt(hexString.substring(i, i + 7), 16).valueOf().toString());
            intString.push(Number( "0x" + hexString.substring(i, i + 8)).toString(10));
        }
        return intString;
    }

    //rt, H_pers, pID, Kpriv, Kpub, directionSelector(bool 3), merkleproof(3*8)
    constructProof(rt: string, hpers: string, pID: string, Kpriv: string, Kpub:string, directionSelector: boolean[], merklePath: string[]) {
        console.log("rt", rt);
        console.log("hpers", hpers);
        console.log("pID", pID);
        console.log("Kpriv", Kpriv);
        console.log("Kpub", Kpub);
        console.log("directionSelector", directionSelector);
        console.log("merklePath", merklePath);

        console.log("rt-out", this.hexStringToDecimalStringArray(rt));
        console.log("hpers-out", this.hexStringToDecimalStringArray(hpers));
        console.log("pID-out", this.hexStringToDecimalStringArray(pID));
        console.log("Kpriv-out", this.hexStringToDecimalStringArray(Kpriv));
        console.log("Kpub-out", this.hexStringToDecimalStringArray(Kpub));

        let directionSelectorDecimalStringArray: string[] = [];
        for (let i = 0; i < directionSelector.length; i++) {
            directionSelectorDecimalStringArray.push(directionSelector[i] ? '1' : '0');
        }
        console.log("direction-Selector-out", directionSelectorDecimalStringArray);

        let merklePathDecimalStringArray:string[][] = [];
        for (let i=0; i<merklePath.length; i++){
            merklePathDecimalStringArray.push(this.hexStringToDecimalStringArray(merklePath[i]));
        }
        console.log("merklePath-out", merklePathDecimalStringArray)

        let zokratesbeweisInput:string = "";
        this.hexStringToDecimalStringArray(rt).forEach(x => zokratesbeweisInput = zokratesbeweisInput +  x +" ");
        this.hexStringToDecimalStringArray(hpers).forEach(x => zokratesbeweisInput = zokratesbeweisInput +  x +" ");
        this.hexStringToDecimalStringArray(pID).forEach(x => zokratesbeweisInput = zokratesbeweisInput +  x +" ");
        this.hexStringToDecimalStringArray(Kpriv).forEach(x => zokratesbeweisInput = zokratesbeweisInput + x +" ");
        this.hexStringToDecimalStringArray(Kpub).forEach(x => zokratesbeweisInput = zokratesbeweisInput + x +" ");
        directionSelectorDecimalStringArray.forEach(x => zokratesbeweisInput = zokratesbeweisInput + x +" ");
        merklePathDecimalStringArray.forEach(x => x.forEach(y => zokratesbeweisInput = zokratesbeweisInput + y +" "));

        console.log("Zokratesbeweisinput", zokratesbeweisInput);

        // getZokratesHelper().then(helperClass => this.helper = helperClass);
        // this.helper.testApp([]);
    }
}