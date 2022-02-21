import { randomBytes } from "crypto";
import { DataHash, MerkleTree, serializeMerkleProof, SHA256Hash } from "../../shared/merkle";
import { Database } from "./database";
import { EthereumConnector } from "./web3";

async function pubkeyHashes(db: Database, period: number): Promise<Array<SHA256Hash>> {
    const pubkeys_to_include = (await db.pubkeys_to_include(period));
    const hashes = new Array<SHA256Hash>();
    for(let hash of pubkeys_to_include) {
        hashes.push(await SHA256Hash.fromHex(hash.substring(2)));
    }
    console.log("Pubkeys to include", pubkeys_to_include, hashes);
    return hashes;
}

async function fillKeyArray(key_hashes: Array<SHA256Hash>, target: number) {
    for(let i = key_hashes.length; i < target; i++) {
        const randomValue = randomBytes(32);
        const randomHash = await SHA256Hash.fromUint8Array(randomValue);
        key_hashes.push(randomHash);
        console.log("Pushed Random Value to Key Array", randomHash.toHex());
    }
}

async function generateAndInsertProofs(db: Database, tree: MerkleTree, hashes_count: number, key_hashes: Array<DataHash>) {
    const promises = [];
    const tree_root_hash = tree.getRoot().hash.toHex();
    for(let idx = 0; idx < hashes_count; idx++) {
        const leaf = tree.leaf(key_hashes[idx]);
        const proof = tree.getProof(leaf);
        const dbproof = serializeMerkleProof(proof);
        console.log(`Proof for leaf ${idx + 1}/${hashes_count}`, dbproof);
        promises.push(db.insertProof(tree_root_hash, key_hashes[idx].toHex(), dbproof));
    }
    return Promise.all(promises);
}

export async function intervalTask(web3: EthereumConnector, db: Database) {
    const period = await web3.period();
    const depth = await web3.depth();
    const target_keys = Math.pow(2, depth);
    
    const key_hashes = await pubkeyHashes(db, period);
    const original_key_hashes_count = key_hashes.length;
    await fillKeyArray(key_hashes, target_keys);

    const tree = new MerkleTree(key_hashes, (x) => SHA256Hash.hashRaw(x));
    await tree.buildTree();
    const tree_root_hash = tree.getRoot().hash.toHex();
    await db.insertTree(tree_root_hash, period);
    await generateAndInsertProofs(db, tree, original_key_hashes_count, key_hashes);
}