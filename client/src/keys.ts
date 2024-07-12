import { MerkleProof, SHA256Hash } from "../../shared/merkle"
import { IDPManager } from "./idp"

interface IRegistration<K, P> {
    keys: K,
    proof?: P
}

interface ICredentialRepository<K, P> {
    [period: string]: IRegistration<K, P>
}

export abstract class KeyManager<K, P> {
    repo: ICredentialRepository<K, P>
    id: string

    constructor(idp: IDPManager, repo?: ICredentialRepository<K, P>) {
        this.id = idp.id;
        this.repo = !repo ? {} : repo;
    }

    async get_key(period: number, generate: boolean = false): Promise<K> {
        if(this.repo.hasOwnProperty(period.toString())) return this.repo[period].keys;
        else if(generate) {
            await this.generate_key(period);
            return this.repo[period].keys;
        }
        throw NoEntryError;
    }

    get_proof(period: number): P {
        if(this.repo.hasOwnProperty(period.toString()) && this.repo[period.toString()].proof) return this.repo[period].proof;
        else throw NoEntryError;
    }

    abstract generate_key(period: number): Promise<void>;
    abstract obtain_proof(period: number): Promise<void>;
}

export const NoEntryError = Error("No entry for given period");

export interface IZKKey {
    privkey: SHA256Hash,
    pubkey: SHA256Hash
}

export interface IZKProofResponse {
    hash: string,
    iteration: number,
    period: number,
    proof: MerkleProof,
}

export const KeyAlreadyAvailable = Error("Key generation requested, but key is already available");

export class ZKKeyManager extends KeyManager<IZKKey, IZKProofResponse> {
    obtainProof(period: number): Promise<void> {
        throw new Error("Method not implemented.")
    }

    async generate_key(period: number) {
        if(this.repo.hasOwnProperty(period.toString())) {
            throw KeyAlreadyAvailable;
        }
        
        const privkey_src = new Uint8Array([
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0
        ]);
        crypto.getRandomValues(privkey_src);
        const privkey = await SHA256Hash.hashRaw(privkey_src);
        const pubkey = await SHA256Hash.hashRaw(privkey.rawValue());
        console.log(`priv: ${privkey.toHex()}`, `pub: ${pubkey.toHex()}, period: ${period}`, privkey, pubkey);

        const keys: IZKKey = {
            privkey,
            pubkey
        };
        this.repo[period.toString()] = {keys};
    }
}

export interface INaiveKey {}

export interface INaiveProofResponse {
    period: number
}

export class NaiveKeyManager extends KeyManager<INaiveKey, INaiveProofResponse> {}
