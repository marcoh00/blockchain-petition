import { checkValidType } from "../../shared/idp"
import { MerkleProof, SHA256Hash } from "../../shared/merkle"
import { IDPManager } from "./idp"
import { getStateAccessors } from "./state"

interface IRegistration<K, P> {
    keys: K,
    proof?: P
}

interface ICredentialRepository<K, P> {
    [period: string]: IRegistration<K, P>
}

export abstract class KeyManager<K, P> {
    repo: ICredentialRepository<K, P>
    idp: IDPManager

    constructor(idp: IDPManager, repo?: ICredentialRepository<K, P>) {
        this.idp = idp;
        this.repo = !repo ? {} : repo;
    }

    async get_key(period: number, generate: boolean = false): Promise<K> {
        if (this.repo.hasOwnProperty(period.toString())) return this.repo[period.toString()].keys;
        else if (generate) {
            this.repo[period.toString()] = { keys: await this.generate_key(period) };
            this.save();
            return this.repo[period.toString()].keys;
        }
        console.trace("No entry error (key)");
        throw NoEntryError;
    }

    async get_proof(period: number, obtain: boolean = false): Promise<P> {
        if (this.repo.hasOwnProperty(period.toString()) && typeof this.repo[period.toString()].proof !== "undefined") return this.repo[period.toString()].proof;
        else if (obtain) {
            const key = await this.get_key(period, true);
            const token = await this.idp.obtain_token(period, await this.client_identity(period));
            const proof = await this.idp.obtain_credentials(period, this.check_proof);
            this.repo[period.toString()].proof = (proof as P);
            this.save();
            return this.repo[period.toString()].proof;
        }
        console.trace(`No entry error (proof). Requested: ${period}. hasProperty? ${this.repo.hasOwnProperty(period.toString())}`)
        throw NoEntryError;
    }

    check_proof(response: any): boolean {
        return true;
    }

    abstract generate_key(period: number): Promise<K>;
    abstract client_identity(period: number): Promise<any>;
    abstract save(): void;
    abstract load(): void;
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
    async generate_key(period: number): Promise<IZKKey> {
        if (this.repo.hasOwnProperty(period.toString())) {
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
        return keys;
    }

    async client_identity(period: number): Promise<any> {
        const key = await this.get_key(period, true);
        return key.pubkey.toHex();
    }

    check_proof(response: any): boolean {
        return super.check_proof(response)
            && checkValidType(["hash", "iteration", "period", "proof"], response)
            && checkValidType(["directionSelector", "path"], response.proof);
    }

    save() {
        const localData = JSON.stringify(this.repo, (key, value) => {
            if (
                typeof value === "object" &&
                value.hasOwnProperty("hash") &&
                typeof value.hash !== "string"
            ) {
                console.log("hashy value", value);
                return (value as SHA256Hash).toHex();
            }
            return value;
        });
        localStorage.setItem(`cred.${this.idp.id}`, localData);
        console.log("Credentials saved to localStorage");
    }

    load() {
        const item = localStorage.getItem(`cred.${this.idp.id}`);
        if (typeof item !== "string") return;
        this.repo = JSON.parse(item, (key, value) =>
            typeof value === "string" &&
                value.length === 64 &&
                (key === "pubkey" || key === "privkey")
                ? SHA256Hash.fromHex(value)
                : value,
        );
        console.log("KM, credentials after load", this.repo);
    }
}

export interface INaiveKey { }

export interface INaiveProofResponse {
    period: number
}

export class NaiveKeyManager extends KeyManager<INaiveKey, INaiveProofResponse> {
    async generate_key(period: number): Promise<INaiveKey> {
        return {};
    }

    async client_identity(period: number): Promise<any> {
        const access_state = getStateAccessors();
        const state = access_state.getState();
        if (typeof (state.connector) === "object" && typeof (state.connector.connector) === "object" && typeof (state.connector.connector.account) === "string") {
            return state.connector.connector.account;
        } else {
            throw new Error("Not connected or no account selected");
        }
    }

    check_proof(response: any): boolean {
        return super.check_proof(response)
            && checkValidType(["hash", "iteration", "period", "proof"], response);
    }

    save() {
        const localData = JSON.stringify(this.repo);
        localStorage.setItem(`cred.${this.idp.id}`, localData);
        console.log("Credentials saved to localStorage");
    }

    load() {
        const item = localStorage.getItem(`cred.${this.idp.id}`);
        if (typeof item !== "string") return;
        this.repo = JSON.parse(item);
        console.log("KM, credentials after load", this.repo);
    }

}
