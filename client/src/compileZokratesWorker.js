import { ZoKratesProvider , initialize, CompilationArtifacts, ProofPoints } from "zokrates-js";

const source = `
    from "hashes/sha256/256bitPadded" import main as hash;
    from "hashes/sha256/512bitPadded" import main as hash_concat;

    const u32 DEPTH = 3;

    def select(bool condition, u32[8] left, u32[8] right) -> (u32[8], u32[8]) {
        return (if condition { right } else { left }, if condition { left } else { right });
    }

    def merkleProofValidation(u32[8] merkleRoot, u32[8] leaf, bool[DEPTH] directionSelector, u32[DEPTH][8] path) -> bool {
        // Start from the leaf
        u32[8] mut digest = leaf;

        // Loop up the tree
        for u32 i in 0..DEPTH {
            (u32[8], u32[8]) h = select(directionSelector[i], digest, path[i]);
            digest = hash_concat(h.0, h.1);
        }

        return digest == merkleRoot;
    }
        


    def main(public u32[8] rt, public u32[8] H_pers, public u32[8] ID_Petition, private u32[8] K_priv, private u32[8] K_pub, private bool[DEPTH] directionSelector,  private u32[DEPTH][8] merkleproof) {
        //K_priv ist Urbild von  K_pub
        assert(K_pub == hash(K_priv));

        //H_pers wurde korrekt berechnet
        assert(H_pers == hash_concat(ID_Petition,K_priv));
        
        //rt enthält K_pub
        assert(merkleProofValidation(rt, K_pub, directionSelector, merkleproof));
    }
`;

var wrapped = null;

function postMessageWrapped(message) {
    console.log("ZoKrates post", wrapped);
    if(wrapped) {
        wrapped(message);
    } else {
        postMessage(message)
    }
}

function doCompile(provider) {
    return provider.compile(source);
}

function compileSource() {
    console.log("[Worker] compileSource");
    return initialize()
        .then(provider => {
            console.log("[Worker] compileSource > initialized");
            console.time("compileSource")
            const compileArtifact = doCompile(provider);
            console.timeEnd("compileSource")
            return compileArtifact;
        })
        .then(compileArtifact => {
            console.log("[Worker] compileSource > finished. Size: ", compileArtifact.program.length);
            postMessageWrapped(["compileSource", compileArtifact]);
        })
        .catch(e => {
            console.log("[Worker] computeWitness > error!", e);
            postMessageWrapped(["error", e]);
        });
}

function computeWitness(artifacts, args) {
    console.log("[Worker] computeWitness", artifacts, args);
    return initialize()
        .then(provider => {
            console.log("[Worker] computeWitness > initialized");
            console.time("computeWitness");
            const result = provider.computeWitness(artifacts, args);
            console.timeEnd("computeWitness");
            return result;
        })
        .then(result => {
            console.log("[Worker] computeWitness > finished", result);
            postMessageWrapped(["computeWitness", result]);
        })
        .catch(e => {
            console.log("[Worker] computeWitness > error!", e);
            postMessageWrapped(["error", e]);
        });
}

function jsProof(program, witness, provingKey) {
    console.log("[Worker] jsProof", program, witness, provingKey);
    return initialize()
        .then(provider => {
            console.log("[Worker] jsProof > initialized");
            console.time("jsProof")
            const result = provider.generateProof(program, witness, provingKey);
            console.timeEnd("jsProof")
            return result;
        })
        .then(result => {
            console.log("[Worker] jsProof > finished", result);
            postMessageWrapped(["jsProof", result]);
        })
        .catch(e => {
            console.log("[Worker] jsProof > error!", e);
            postMessageWrapped(["error", e]);
        });
}

onmessage = function(e) {
    console.log("ZoKrates onmessage");
    return external_onmessage(e);
}

function external_onmessage(e) {
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
        postMessageWrapped(["error", e]);
    }
}

export function wrapper(e, res) {
    console.log("ZoKrates wrapper");
    wrapped = res;
    external_onmessage(e);
}
