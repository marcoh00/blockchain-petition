import { randomBytes } from "crypto";
import { DataHash, MerkleTree, serializeMerkleProof, SHA256Hash } from "../../shared/merkle";
import { NaiveEthereumConnector, ZKEthereumConnector } from "../../shared/web3";
import { checkValidType, IRegistration } from "./api"
import { Database } from "./database";

class WebResult {
    success: boolean
    _status?: number
    _ret?: object | string

    constructor(success: boolean, status?: number, ret?: object | string) {
        this.success = success;
        this._status = status;
        this._ret = ret;
    }

    get status(): number {
        return typeof(this._status) === "number" ? this._status : (this.success ? 200 : 500);
    }

    get ret(): object {
        if(typeof(this._ret) === "object") return this._ret;
        else if(typeof(this._ret) === "string") {
            if(this.success) return { "result": this._ret };
            else return { "error": this._ret };
        }
        else {
            if(this.success) return { "result": true };
            else return { "error": "Internal Server Error" };
        }
    }
}

export interface IProofHandler {
    check_registration_info(registration: IRegistration, minperiod: number, maxperiod: number): Promise<WebResult>
    update_web3_info(web3info: object): Promise<void>
    register(registration: IRegistration, token: string): Promise<WebResult>
    interval_task()
}

interface EventInformation {
    "hash": string,
    "period": any,
    "iteration": any
}

const invalidHex = /[^0-9A-Fa-f]/;

function registrationPeriodCheck(registration: IRegistration, minperiod: number, maxperiod: number): boolean {
    if(minperiod && maxperiod && (registration.period < minperiod || registration.period > maxperiod)) return false;
    return true;
}

export class ZKProofHandler implements IProofHandler {
    connector: ZKEthereumConnector
    database: Database
    interval_lock: boolean

    constructor(connector: ZKEthereumConnector, database: Database) {
        this.connector = connector;
        this.database = database;
        this.interval_lock = false;
    }

    check_registration_info(registration: IRegistration, minperiod: number, maxperiod: number): Promise<WebResult> {
        if(!checkValidType(["identity", "client_identity", "period"], registration)) {
            return Promise.resolve(new WebResult(false, 400, "Malformed Request"));
        }
        if(
            !registrationPeriodCheck(registration, minperiod, maxperiod)
            || registration.client_identity.length != 64 // Invalid SHA-256 Hash
            || invalidHex.test(registration.client_identity)
        ) {
            return Promise.resolve(new WebResult(false, 400, "Invalid registration"));
        }
        return Promise.resolve(new WebResult(true));
    }

    async update_web3_info(web3info: any): Promise<void> {
        web3info.idp.depth = await this.connector.idpcontract.methods.depth().call();
    }

    async register(registration: IRegistration, token: string): Promise<WebResult> {
        if(await this.database.isRegistered(registration)) {
            return new WebResult(false, 405, "Public Key is already registered for given period");
        }
        try {
            const result = await this.database.register(registration, token);
            console.log(`💾 Registration saved to database`, registration, token, result);
            return new WebResult(true, 200, {"token": token});
        } catch(e) {
            console.log("Registration: Database error", e);
            return new WebResult(false, 500, "Database error");
        }
    }

    async interval_task() {
        if(this.interval_lock) {
            console.log("❌ Will not try to create any trees because the previous task has not finished.");
            return;
        }
        this.interval_lock = true;
    
        const period = await this.connector.period();
        const depth = await this.connector.depth();
        const target_keys = Math.pow(2, depth);
        
        const key_hashes = await this.pubkeyHashes(period);
        const original_key_hashes_count = key_hashes.length;
        if(original_key_hashes_count === 0) {
            console.log("❌ Will not try to create any trees because there were no inclusion requests");
            this.interval_lock = false;
            return;
        }
        await this.fillKeyArray(key_hashes, target_keys);
        const tree = new MerkleTree(key_hashes, (x) => SHA256Hash.hashRaw(x));
        await tree.buildTree();
        const tree_root_hash = tree.getRoot().hash.toHex();
        await this.database.insertTree(tree_root_hash, period);
        await this.generateAndInsertProofs(tree, original_key_hashes_count, key_hashes);
    
        const trees_to_include = await this.database.treesToIncludeOnBlockchain(period);
        console.log("Trees to Include", trees_to_include);
        const includeEvents = await this.includeTrees(period, trees_to_include);
    
        for (const event of includeEvents) {
            console.log("Include Event", event);
            await this.database.updateTreeWithIteration(event["hash"], event["iteration"]);
        }
        
        this.interval_lock = false;
    }

    async pubkeyHashes(period: number): Promise<Array<SHA256Hash>> {
        const pubkeys_to_include = await this.database.pubkeys_to_include(period);
        const hashes = new Array<SHA256Hash>();
        for(let hash of pubkeys_to_include) {
            hashes.push(SHA256Hash.fromHex(hash));
        }
        return hashes;
    }
    
    async fillKeyArray(key_hashes: Array<SHA256Hash>, target: number) {
        for(let i = key_hashes.length; i < target; i++) {
            const randomValue = randomBytes(32);
            const randomHash = await SHA256Hash.fromUint8Array(randomValue);
            key_hashes.push(randomHash);
            // console.log("Pushed Random Value to Key Array", randomHash.toHex());
        }
    }
    
    async generateAndInsertProofs(tree: MerkleTree, hashes_count: number, key_hashes: Array<DataHash>) {
        const promises = [];
        const tree_root_hash = tree.getRoot().hash.toHex();
        for(let idx = 0; idx < hashes_count; idx++) {
            const leaf = tree.leaf(key_hashes[idx]);
            const proof = tree.getProof(leaf);
            const dbproof = serializeMerkleProof(proof);
            console.log(`Proof for leaf ${idx + 1}/${hashes_count}`, dbproof);
            promises.push(this.database.insertProof(tree_root_hash, key_hashes[idx].toHex(), dbproof));
        }
        return Promise.all(promises);
    }
    
    async includeTrees(period: number, trees_to_include: Array<string>): Promise<Array<EventInformation>> {
        const iteration_promises = [];
        for(let tree of trees_to_include) {
            const event = await this.connector.submitHash_zk(tree, period);
            const hash_result = event.returnValues[0] as string;
            const hash = hash_result.startsWith("0x") ? hash_result.substring(2) : hash_result;
            iteration_promises.push({"hash": hash, 
            "period": event.returnValues[1], 
            "iteration": event.returnValues[2]});
        }
        return await Promise.resolve(iteration_promises);
    }
    
    async addIterationsToDatabase(db: Database, trees: Array<string>, iterations: Array<number>) {
        for(let idx = 0; idx < trees.length; idx++) {
            await db.updateTreeWithIteration(trees[idx], iterations[idx]);
        }
    }

}

export class NaiveProofHandler implements IProofHandler {
    connector: NaiveEthereumConnector
    database: Database
    interval_lock: boolean

    constructor(connector: NaiveEthereumConnector, database: Database) {
        this.connector = connector;
        this.database = database;
        this.interval_lock = false;
    }

    check_registration_info(registration: IRegistration, minperiod: number, maxperiod: number): Promise<WebResult> {
        if(!checkValidType(["identity", "client_identity", "period"], registration)) {
            return Promise.resolve(new WebResult(false, 400, "Malformed Request"));
        }
        if(
            !registrationPeriodCheck(registration, minperiod, maxperiod)
            || registration.client_identity.length != 42 // Invalid Ethereum address (160bit ~ 20 Byte ~ 40 Hex Chars + '0x')
            || ! registration.client_identity.startsWith("0x")
            || invalidHex.test(registration.client_identity.substring(2)) // Every character apart from 0x is a hex char
        ) {
            return Promise.resolve(new WebResult(false, 400, "Invalid registration"));
        }
        return Promise.resolve(new WebResult(true));
    }
    update_web3_info(web3info: object): Promise<void> {
        return Promise.resolve();
    }
    async register(registration: IRegistration, token: string): Promise<WebResult> {
        if(await this.database.isRegistered(registration)) {
            return new WebResult(false, 405, "Public Key is already registered for given period");
        }
        try {
            const result1 = await this.database.register(registration, token);
            // TODO Rework database design such that other schemes do not have to fit into the "pubkey in tree" model
            // We work around this by considering pubkey = tree = client_identity = ethereum_address w/ an arbitrary proof value
            // Of course this can fail in exciting ways when not all queries are made inside the same transaction (which they are not) 
            // and some fail while others do not.
            const result2 = await this.database.insertTree(registration.client_identity, registration.period);
            const result3 = await this.database.insertProof(registration.client_identity, registration.client_identity, "[]");
            console.log(`💾 Registration saved to database`, registration, token, result1, result2, result3);
            return new WebResult(true, 200, {"token": token});
        } catch(e) {
            console.log("Registration: Database error", e);
            return new WebResult(false, 500, "Database error");
        }
    }

    async interval_task() {
        if(this.interval_lock) {
            console.log("❌ Will not try to create any trees because the previous task has not finished.");
            return;
        }
        this.interval_lock = true;

        const period = await this.connector.period();
        // TODO, see "register": pubkey = tree = client_identity = ethereum_address
        const pubkeys_to_include = await this.database.treesToIncludeOnBlockchain(period);
        for(const pubkey of pubkeys_to_include) {
            try {
                await this.connector.submitHash(pubkey, period);
                console.log(`🌐 Submitted address ${pubkey} to the blockchain`);
                await this.database.updateTreeWithIteration(pubkey, 1);
            } catch(e) {
                console.log("❌ Unable to submit address", e);
            }
        }

        this.interval_lock = false;
    }

}
