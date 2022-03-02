import { html, LitElement } from "lit";
import { property } from "lit/decorators.js";
import { ZoKratesProvider , initialize } from "zokrates-js";
import { SHA256Hash } from "../../shared/merkle";
import { decorateClassWithState, IState } from "./state";

class ZokratesHelper {
    provider: ZoKratesProvider;
    constructor() {}
    async init() {
        this.provider = await initialize();
    }

    testApp(state: IState) {
        const source = `
            import "hashes/sha256/256bitPadded" as hash
            import "hashes/sha256/512bit" as hash_concat
            
            const u32 DEPTH = 3
            
            def select(bool condition, u32[8] left, u32[8] right) -> (u32[8], u32[8]):
                return if condition then right else left fi, if condition then left else right fi
            
            def merkleProofValidation(u32[8] merkleRoot, u32[8] leaf, bool[DEPTH] directionSelector, u32[DEPTH][8] path) -> bool:
                // Start from the leaf
                u32[8] digest = leaf
            
                // Loop up the tree
                for u32 i in 0..DEPTH do
                    u32[8] left, u32[8] right = select(directionSelector[i], digest, path[i])
                    digest = hash_concat(left, right)
                endfor
            
                return digest == merkleRoot
                
            
            
            def main(public u32[8] rt, public u32[8] H_pers, public u32[8] ID_Petition, private u32[8] K_priv, private u32[8] K_pub, private bool[DEPTH] directionSelector,  private u32[DEPTH][8] merkleproof):
                //K_priv ist Urbild von  K_pub
                assert(K_pub == hash(K_priv))
            
                //H_pers wurde korrekt berechnet
                assert(H_pers == hash_concat(ID_Petition,K_priv))
                
                //rt enthält K_pub
                assert(merkleProofValidation(rt, K_pub, directionSelector, merkleproof))
                
                return
        `;

        // compilation
        const artifacts = this.provider.compile(source);
        console.log("artifacts", artifacts)

        // computation
        // Input is:
        // public u32[8] rt,
        // public u32[8] H_pers,
        // public u32[8] ID_Petition,
        // private u32[8] K_priv,
        // private u32[8] K_pub,
        // private bool[DEPTH=3] directionSelector,
        // private u32[DEPTH=3][8] merkleproof

        const { witness, output } = this.provider.computeWitness(artifacts, ["2"]);
        console.log("witness, output", witness, output);

        // run setup
        const keypair = this.provider.setup(artifacts.program);
        console.log("keypair", keypair);

        // generate proof
        const proof = this.provider.generateProof(artifacts.program, witness, keypair.pk);
        console.log("proof", proof);

        // export solidity verifier
        const verifier = this.provider.exportSolidityVerifier(keypair.vk);
        console.log("verifier", verifier);
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

    constructProof() {
        this.helper.testApp(this.getState());
    }
}