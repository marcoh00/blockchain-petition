let subtle_module: SubtleCrypto = undefined;

function subtleModule(): SubtleCrypto {
    if(typeof(subtle_module) !== "undefined") return subtle_module;
    if(typeof(crypto) === "undefined") {
        // Node.JS
        console.log(`crypto.subtle is undefined, running in nodejs`);
        const { subtle } = require('crypto').webcrypto;
        subtle_module = subtle;
    }
    else if(typeof(crypto.subtle) === "object") {
        console.log(`crypto.subtle is defined`, crypto.subtle);
        subtle_module = crypto.subtle;
    }
    console.log(`Return`, subtle_module)
    return subtle_module;
}

export abstract class DataHash implements DataHash {
    private hash: Uint8Array;

    constructor(array: Uint8Array, length: number) {
        if(array.length != length) throw new Error(`Hash values of this type must have a length of exactly 32 bytes (is ${array.length})`);
        this.hash = array;
    }

    rawValue(): Uint8Array {
        return this.hash;
    }
    toHex(): string {
        const hashArray = Array.from(this.hash);
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
    }
    equals(other: DataHash): boolean {
        return this.hash.length == other.rawValue().length && this.hash.every((value, index) => value === other.rawValue()[index]);
    }

    static fromHex(hex: string): DataHash {
        const buffer = Buffer.from(hex, 'hex');
        const data = Uint8Array.from(buffer);
        return this.fromUint8Array(data);
    }
    static async fromStringViaCryptoAPI(input: string, algorithm: string): Promise<DataHash> {
        const encoder = new TextEncoder();
        const data = encoder.encode(input);
        return this.fromUint8ArrayViaCryptoAPI(data, algorithm);
    }
    static async fromUint8ArrayViaCryptoAPI(data: Uint8Array, algorithm: string): Promise<DataHash> {
        const buffer = await subtleModule().digest(algorithm, data)
        return this.fromUint8Array(new Uint8Array(buffer));
    }
    static async fromArrayBuffer(buffer: ArrayBuffer): Promise<DataHash> {
        return this.fromUint8Array(new Uint8Array(buffer));
    }

    static async hashRaw(data: Uint8Array): Promise<DataHash> {
        throw new Error("Not implemented");
    }
    static async hashString(input: string): Promise<DataHash> {
        throw new Error("Not implemented");
    }
    static fromUint8Array(array: Uint8Array): DataHash {
        throw new Error("Not implemented");
    }
}

class ZeroHash extends DataHash {
    constructor() {
        super(new Uint8Array([]), 0);
    }
}

export class SHA256Hash extends DataHash {
    constructor(array: Uint8Array) {
        super(array, 32);
    }

    static async hashRaw(data: Uint8Array): Promise<DataHash> {
        return this.fromUint8ArrayViaCryptoAPI(data, 'SHA-256');
    }
    static async hashString(input: string): Promise<DataHash> {
        return this.fromStringViaCryptoAPI(input, 'SHA-256');
    }

    static fromUint8Array(array: Uint8Array): DataHash {
        return new SHA256Hash(array);
    }
}

enum Direction {
    Left,
    Right
}

class MerkleNode {
    hash: DataHash;
    height: number;
    top?: MerkleInode;

    constructor(hash: DataHash, height: number, top?: MerkleInode) {
        this.hash = hash;
        this.height = height;
        this.top = top;
    }

    equals(other: MerkleNode): boolean {
        return this.hash.equals(other.hash);
    }
}

class MerkleInode extends MerkleNode {
    left: MerkleNode;
    right: MerkleNode;

    hashfunc: (x: Uint8Array) => Promise<DataHash>;

    constructor(left: MerkleNode, right: MerkleNode, height: number, datahash: (x: Uint8Array) => Promise<DataHash>, top?: MerkleInode) {
        super(new ZeroHash(), height, top);
        this.left = left;
        this.right = right;
        this.hashfunc = datahash;
    }

    async calcHash() {
        const concatenatedChildren = new Uint8Array([...Array.from(this.left.hash.rawValue()), ...Array.from(this.right.hash.rawValue())]);
        const hash = await this.hashfunc(concatenatedChildren);
        this.hash = hash;
        console.log(`[MerkleInode] {height=${this.height}, hash=${hash.toHex()}, left=${this.left.hash.toHex()}, right=${this.right.hash.toHex()}}`);
    }

    which(hash: DataHash): Direction {
        if(hash.equals(this.left.hash)) return Direction.Left;
        else if(hash.equals(this.right.hash)) return Direction.Right;
        throw new Error("Merkle Inode does not contain given hash child");
    }
}

export interface MerkleProof {
    directionSelector: Array<boolean>,
    path: Array<DataHash>
}

export function serializeMerkleProof(proof: MerkleProof): string {
    return JSON.stringify({
        directionSelector: proof.directionSelector,
        path: proof.path.map((hash) => hash.toHex())
    });
}

export class MerkleTree {
    private depth: number;
    private root?: MerkleInode;
    private leafs: Array<MerkleNode>;
    hashfunc: (x: Uint8Array) => Promise<DataHash>;

    constructor(leafs: Array<DataHash>, hashfunc: (x: Uint8Array) => Promise<DataHash>) {
        const depth = Math.log2(leafs.length);
        if(depth != Math.ceil(depth)) {
            throw new Error("Merkle Tree must have 2^n leafs");
        }
        this.depth = depth;
        console.log(`Construct Merkle Tree with depth=${this.depth}`);
        this.hashfunc = hashfunc;
        this.leafs = leafs.map((datahash) => new MerkleNode(datahash, this.depth));
    }

    async buildTree() {
        const allNodes: Array<Array<MerkleNode>> = new Array();
        for(let i = 0; i <= this.depth; i++) allNodes.push(new Array());
        allNodes[this.depth] = this.leafs;

        for(let cdepth = this.depth - 1; cdepth >= 0; cdepth--) {
            console.log(`Construct Merkle Tree at depth=${cdepth} with ${Math.pow(2, cdepth)} elements`);
            for(let element = 0; element < Math.pow(2, cdepth + 1); element += 2) {
                const newNode = new MerkleInode(
                    allNodes[cdepth + 1][element],
                    allNodes[cdepth + 1][element + 1],
                    cdepth,
                    this.hashfunc
                );
                await newNode.calcHash();
                allNodes[cdepth + 1][element].top = newNode;
                allNodes[cdepth + 1][element + 1].top = newNode;
                allNodes[cdepth].push(newNode);
            }
        }
        this.root = allNodes[0][0] as MerkleInode;
    }

    getRoot(): MerkleInode {
        if(this.root === undefined) throw new Error("Calculate the whole tree first by calling buildTree");
        return this.root;
    }

    leaf(hash: DataHash): MerkleNode {
        return this.leafs.find((value) => value.hash.equals(hash));
    }

    getProof(leaf: MerkleNode): MerkleProof {
        if(this.leafs.find((value) => value.equals(leaf)) === undefined) throw new Error("Invalid leaf");
        const directionSelector: Array<boolean> = new Array();
        const path: Array<DataHash> = new Array();

        let current_node = leaf;
        for(let i = 0; i < this.depth; i++) {
            let parent = current_node.top;
            let which = parent.which(current_node.hash);
            directionSelector.push(which === Direction.Left ? false : true);
            path.push(which === Direction.Left ? parent.right.hash : parent.left.hash);

            current_node = parent;
        }

        const result = {
            directionSelector,
            path
        };
        console.log("Merkle Proof", result);
        console.log("Path", result.path.map((hash) => hash.toHex()));
        return result;
    }
}