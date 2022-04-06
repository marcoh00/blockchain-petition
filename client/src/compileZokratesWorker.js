import { ZoKratesProvider , initialize, CompilationArtifacts, ProofPoints } from "zokrates-js";

const source = `
    import "hashes/sha256/256bitPadded" as hash
    import "hashes/sha256/512bitPadded" as hash_concat
    
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

function doCompile(provider) {
    return provider.compile(source);
}
function compileSource() {
    console.log("[Worker] compileSource");
    return initialize()
        .then(provider => {
            console.log("[Worker] compileSource > initialized");
            return doCompile(provider)
        })
        .then(compileArtifact => {
            console.log("[Worker] compileSource > finished", compileArtifact);
            postMessage(["compileSource", compileArtifact]);
        })
        .catch(e => {
            console.log("[Worker] computeWitness > error!", e);
            postMessage(["error", e]);
        });
}

function computeWitness(artifacts, args) {
    console.log("[Worker] computeWitness", artifacts, args);
    return initialize()
        .then(provider => {
            console.log("[Worker] computeWitness > initialized");
            return provider.computeWitness(artifacts, args);
        })
        .then(result => {
            console.log("[Worker] computeWitness > finished", result);
            postMessage(["computeWitness", result]);
        })
        .catch(e => {
            console.log("[Worker] computeWitness > error!", e);
            postMessage(["error", e]);
        });
}

function jsProof(program, witness, provingKey) {
    console.log("[Worker] jsProof", program, witness, provingKey);
    return initialize()
        .then(provider => {
            console.log("[Worker] jsProof > initialized");
            return provider.generateProof(program, witness, provingKey);
        })
        .then(result => {
            console.log("[Worker] jsProof > finished", result);
            postMessage(["jsProof", result]);
        })
        .catch(e => {
            console.log("[Worker] jsProof > error!", e);
            postMessage(["error", e]);
        });
}

onmessage = function(e) {
    // e.data[0] verb
    // - compileSource
    // - computeWitness
    //   >> e.data[1] compilation artifacts
    //   >> e.data[2] args
    // - jsProof
    //   >> e.data[1] program
    //   >> e.data[2] witness
    //   >> e.data[3] proving key

    try {
        switch(e.data[0]) {
            case "compileSource":
                Promise.all([compileSource()]);
                break;
            case "computeWitness":
                Promise.all([computeWitness(e.data[1], e.data[2])]);
                break;
            case "jsProof":
                Promise.all([jsProof(e.data[1], e.data[2], e.data[3])]);
                break;
        }
    } catch(e) {
        console.log("[Worker] error!", e);
        this.postMessage(["error", e]);
    }
}