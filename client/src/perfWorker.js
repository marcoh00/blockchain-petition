import { ZokratesHelper } from "./zokrates";
import { SHA256Hash } from "../../shared/merkle";
import { Identity } from "@semaphore-protocol/core"
import { generateProof, Group } from "@semaphore-protocol/core";
import { deserialize_semaphore_proof_info } from "../../shared/idp"
import init, { Algorithm, JsGroupManagerPublicKey, JsIccSecretKey, JsPublicKey, init_panic_hook } from "pss-rs-wasm";

import { wrapper } from "./compileZokratesWorker";

var zokrates_helper = new ZokratesHelper();
var zokrates_init = false;
var pss_init = false;

function load_key_zk(idp) {
    console.log("loadkeyzk", idp);
    const repo = JSON.parse(idp, (key, value) =>
        typeof value === "string" &&
            value.length === 64 &&
            (key === "pubkey" || key === "privkey")
            ? SHA256Hash.fromHex(value)
            : value,
    );
    const objkeys = Object.keys(repo).sort();
    return repo[objkeys[objkeys.length - 1]];
}

function load_key_semaphore(idp) {
    //console.log("loadkeysemaphore", idp);
    const repo = JSON.parse(idp, (key, value) => {
        switch (key) {
            case "keys":
                console.log("Import Identity from String", value);
                return Identity.import(value);
            case "proof":
                return JSON.parse(value);
            default:
                return value;
        }
    });
    const objkeys = Object.keys(repo).sort();
    //console.log("repo", repo, objkeys);
    const ret = repo[objkeys[objkeys.length - 1]];
    ret.proof.proof = deserialize_semaphore_proof_info(ret.proof.proof);
    //console.log(ret);
    return ret;
}

async function sign_zk(petition, key, connector) {
    if (typeof (zokrates_helper) !== "object" || zokrates_helper === null || zokrates_init === false) {
        const wrappedWorker = {
            onmessage: function(e) { console.trace(e) },
            postMessage: function(message) {
                const parentthis = this;
                console.log("who is this", parentthis);
                wrapper({data: message}, function(res) { parentthis.onmessage({data: res}) })
            }
        };
        zokrates_helper = new ZokratesHelper(wrappedWorker, "http://localhost:65530/proving.key");
        await zokrates_helper.init();
        zokrates_init = true;
    }
    const pers = [
        ...Array.from(petition.id),
        ...Array.from(key.keys.privkey.rawValue())
    ];
    const hpers = await SHA256Hash.hashRaw(new Uint8Array(pers));
    const zokrates_proof = await zokrates_helper.constructProof(
        petition,
        hpers,
        key.keys,
        key.proof
    );
}

async function sign_semaphore(petition, idp, connector) {
    const key = idp.keys;
    const proof_data = idp.proof.proof;
    const group = new Group(proof_data.members);
    console.log("Proof input", key, group, proof_data.members, petition.id);
    console.time("Semaphore Proof");
    const proof = await generateProof(key, group, 1936287598, petition.id);
    console.timeEnd("Semaphore Proof");
}

async function sign_pss(petition, idp, connector, alg) {
    if(!pss_init) {
        await init();
        init_panic_hook();
        pss_init = true;
    }
    console.log("idp data, connector data", idp, connector);
    const period = "1";
    const key = idp[period].proof;
    const sk_icc_1_u = new Uint8Array(key.proof.sk_icc_1_u);
    const sk_icc_2_u = new Uint8Array(key.proof.sk_icc_2_u);
    const icc = new JsIccSecretKey(sk_icc_1_u, sk_icc_2_u);
    const pk_m = new Uint8Array(connector.pk_m);
    const pk_icc = new Uint8Array(connector.pk_icc);
    const pk_sector = new Uint8Array(connector.sectors[0].pk_sector);
    const pubkey = new JsGroupManagerPublicKey(pk_m, pk_icc);
    console.log("Trying to sign with sk_icc_1_u", sk_icc_1_u, "sk_icc_2_u", sk_icc_2_u, "alg", alg, "pk_m", pk_m, "pk_icc", pk_icc, "pk_sector", pk_sector);
    console.time("PssSig");
    const signature = icc.sign(alg, pubkey, new JsPublicKey(pk_sector), true, false, petition.id);
    console.timeEnd("PssSig");
}

async function sign_pss_secp256k1(petition, key, connector) {
    return await sign_pss(petition, key, connector, Algorithm.Secp256k1);
}

async function sign_pss_altbn128(petition, key, connector) {
    return await sign_pss(petition, key, connector, Algorithm.AltBn128);
}

function parse_keydata(key, alg) {
    switch(alg) {
        case "zk":
            return load_key_zk(key);
        case "semaphore":
            return load_key_semaphore(key);
        case "psssecp256k1":
            return JSON.parse(key);
        case "pssaltbn128":
            return JSON.parse(key);
    }
}

function parse_connectordata(data, alg) {
    switch(alg) {
        case "zk":
            return null;
        case "semaphore":
            return null;
        case "psssecp256k1":
            return JSON.parse(data);
        case "pssaltbn128":
            return JSON.parse(data);
    }
}

function get_alg_function(alg) {
    switch(alg) {
        case "zk":
            return sign_zk;
        case "semaphore":
            return sign_semaphore;
        case "psssecp256k1":
            return sign_pss_secp256k1;
        case "pssaltbn128":
            return sign_pss_altbn128;
    }
}

function generatePetition() {
    const petition_id = new Uint8Array(32);
    crypto.getRandomValues(petition_id);
    return {
        address: "0x0",
        id: petition_id
    };
}


async function do_measurements(algfunc, maxtime, maxruns) {
    postMessage(["initializing", 0, 0]);
    await algfunc(generatePetition());

    postMessage(["measuring", 0, 0]);
    let runs = 0;
    let start = performance.now();
    let timer = 0;
    let runtime = () => performance.now() - start;
    let timed_out = (current_runtime) => typeof(maxtime) === "number" && maxtime > 0 ? current_runtime > maxtime : false;
    while(!timed_out(timer) && runs < maxruns) {
        await algfunc(generatePetition());
        runs++;
        timer = runtime();
        postMessage(["measuring", runs, timer]);
    }
    console.log("timed out", timed_out(timer), "runs", runs, "maxruns", maxruns, "maxtime", maxtime, "timer", timer);
    postMessage(["measured", runs, timer]);
    
}

onmessage = async function(e) {
    // e.data
    // 0 key data
    // 1 connector data
    // 2 alg
    // 3 maxtime
    // 4 maxruns

    const key = e.data[0];
    const connector = e.data[1];
    const alg = e.data[2];

    const key_parsed = parse_keydata(key, alg);
    const connector_parsed = parse_connectordata(connector, alg);

    console.trace("run perf measurements", key_parsed, connector_parsed, alg);

    const alg_function = async (petition) => await get_alg_function(alg)(petition, key_parsed, connector_parsed);
    await do_measurements(alg_function, e.data[3], e.data[4]);
}
