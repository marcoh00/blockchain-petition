import { generateProof, Group } from "@semaphore-protocol/core";
import { SHA256Hash } from "../../shared/merkle";
import { IPetition, NaiveEthereumConnector, PetitionType, PssEthereumConnector, SemaphoreEthereumConnector, ZKEthereumConnector } from "../../shared/web3";
import { IDPManager } from "./idp";
import { KeyManager, NaiveKeyManager, NoEntryError, PssKeyManager, SemaphoreKeyManager, ZKKeyManager } from "./keys";
import { decorateClassWithState } from "./state";
import { ZokratesHelper } from "./zokrates";
import init, { Algorithm, JsGroupManagerPublicKey, JsIccSecretKey, JsPublicKey, init_panic_hook } from "pss-rs-wasm";

export interface IClientProvider {
    sign(petition: IPetition): Promise<void>;
    signable(petition: IPetition): Promise<boolean>
    signed(petition: IPetition): Promise<boolean>
    key_manager(idp: IDPManager): Promise<KeyManager<any, any>>
}

class ClientProviderBase { }

export class ZKClientProvider extends decorateClassWithState(ClientProviderBase) implements IClientProvider {
    get zkconnector() { return this.getState().connector.connector as ZKEthereumConnector }
    get keymanager() { return this.getState().keymanager as ZKKeyManager }

    zokrates_helper?: ZokratesHelper

    async sign(petition: IPetition): Promise<void> {
        await this._init();
        const hpers = await this._hpers(petition);
        const key = await this.keymanager.get_key(petition.period);
        const idp_proof = await this.keymanager.get_proof(petition.period);
        const zokrates_proof = await this.zokrates_helper.constructProof(
            petition,
            hpers,
            key,
            idp_proof
        );
        await this.zkconnector.signPetition_zk(petition.address, zokrates_proof.points, hpers, idp_proof.iteration);
    }
    async signable(petition: IPetition): Promise<boolean> {
        return !await this.signed(petition);
    }
    async signed(petition: IPetition): Promise<boolean> {
        try {
            const hpers = await this._hpers(petition);
            return await this.zkconnector.hasSigned_zk(petition.address, hpers);
        } catch (e) {
            // No proof available, so we can't have signed this
            if (e == NoEntryError) return false;
            throw e;
        }
    }

    async key_manager(idp: IDPManager): Promise<KeyManager<any, any>> {
        return new ZKKeyManager(idp);
    }

    async _hpers(petition: IPetition): Promise<SHA256Hash> {
        const regist_data = await this.keymanager.get_key(petition.period);
        const pers = [
            ...Array.from(petition.id),
            ...Array.from(regist_data.privkey.rawValue())
        ];
        return await SHA256Hash.hashRaw(new Uint8Array(pers));
    }

    async _init() {
        if (typeof (this.zokrates_helper) !== "object") {
            this.zokrates_helper = new ZokratesHelper();
            await this.zokrates_helper.init();
        }
    }
}

export class NaiveClientProvider extends decorateClassWithState(ClientProviderBase) implements IClientProvider {
    get nconnector() { return this.getState().connector.connector as NaiveEthereumConnector }
    get keymanager() { return this.getState().keymanager as NaiveKeyManager }

    async sign(petition: IPetition): Promise<void> {
        await this.ensure_registered(petition.period);
        await this.nconnector.signPetition(petition.address);
    }

    async signable(petition: IPetition): Promise<boolean> {
        return !await this.signed(petition);
    }

    async signed(petition: IPetition): Promise<boolean> {
        try {
            await this.ensure_registered(petition.period);
        } catch (e) {
            return false;
        }
        const signed = await this.nconnector.hasSigned(petition.address);
        return signed;
    }

    async key_manager(idp: IDPManager): Promise<KeyManager<any, any>> {
        return new NaiveKeyManager(idp);
    }

    async ensure_registered(period: number) {
        // We just want the exception here if we haven't got any proof that we're allowed to sign:
        const hash_added = await this.keymanager.get_proof(period);
        if (hash_added.period != period) throw Error("Should never happen");
    }
}

export interface IPetitionSignature {
    c: Uint8Array
    s1: Uint8Array
    s2: Uint8Array
    i_sector_icc_1: Uint8Array
}

export class PssClientProvider extends decorateClassWithState(ClientProviderBase) implements IClientProvider {
    get pssconnector() { return this.getState().connector.connector as PssEthereumConnector }
    get keymanager() { return this.getState().keymanager as PssKeyManager }

    initialized: boolean

    constructor() {
        super();
        this.initialized = false;
    }

    async sign(petition: IPetition): Promise<void> {
        await this._init();
        const signature = await this._get_signature(petition);
        const tx = await this.pssconnector.signPetition(petition.address, signature.c, signature.s1, signature.s2, signature.i_sector_icc_1);
    }

    async signable(petition: IPetition): Promise<boolean> {
        await this._init();
        return !await this.signed(petition);
    }

    async signed(petition: IPetition): Promise<boolean> {
        await this._init();
        try {
            const signature = await this._get_signature(petition);
            return await this.pssconnector.hasSigned(petition.address, signature.i_sector_icc_1);;
        } catch (e) {
            if (e == NoEntryError) {
                return false;
            }
            throw e;
        }
    }

    async key_manager(idp: IDPManager): Promise<KeyManager<any, any>> {
        return new PssKeyManager(idp);
    }

    async _init(): Promise<void> {
        if (this.initialized) {
            return;
        }
        await init();
        init_panic_hook();

        this.initialized = true;
    }

    async _get_signature(petition: IPetition): Promise<IPetitionSignature> {
        await this._init();
        const key = await this.keymanager.get_proof(1);
        const sk_icc_1_u = new Uint8Array(key.proof.sk_icc_1_u);
        const sk_icc_2_u = new Uint8Array(key.proof.sk_icc_2_u);
        const icc = new JsIccSecretKey(sk_icc_1_u, sk_icc_2_u);
        const pk_m = this.pssconnector.pk_m;
        const pk_icc = this.pssconnector.pk_icc;
        const pk_sector = this.pssconnector.pk_sector;
        const pubkey = new JsGroupManagerPublicKey(pk_m, pk_icc);
        const alg = await this.pss_rs_algorithm(key.proof.algorithm);
        console.log("Trying to sign with sk_icc_1_u", sk_icc_1_u, "sk_icc_2_u", sk_icc_2_u, "alg", alg, "pk_m", pk_m, "pk_icc", pk_icc, "pk_sector", pk_sector);
        const signature = icc.sign(alg, pubkey, new JsPublicKey(pk_sector), true, false, petition.id);
        return {
            c: signature.c,
            s1: signature.s1,
            s2: signature.s2,
            i_sector_icc_1: signature.pseudonym1
        };
    }

    async pss_rs_algorithm(alg: string): Promise<Algorithm> {
        switch (alg) {
            case "secp256k1": {
                if (this.getState().connector.connector.petitiontype() != PetitionType.PSSSecp256k1) {
                    throw new Error("Smart Contract PSS algorithm does not match given key");
                }
                console.log("secp256k1");
                return Algorithm.Secp256k1;
            }
            case "alt-bn128": {
                if (this.getState().connector.connector.petitiontype() != PetitionType.PSSAltBn128) {
                    throw new Error("Smart Contract PSS algorithm does not match given key");
                }
                console.log("altbn128");
                return Algorithm.AltBn128;
            }
            default: {
                throw new Error("Unknown PSS algorithm");
            }
        }
    }
}

export class SemaphoreClientProvider extends decorateClassWithState(ClientProviderBase) implements IClientProvider {
    get connector() { return this.getState().connector.connector as SemaphoreEthereumConnector }
    get keymanager() { return this.getState().keymanager as SemaphoreKeyManager }

    async sign(petition: IPetition): Promise<void> {
        const key = await this.keymanager.get_key(1);
        const proof_data = await this.keymanager.get_proof(1);
        const group = new Group(proof_data.members);
        const proof = await generateProof(key.identity, group, "sign", petition.id);
        console.log("Generated proof", proof);
    }
    async signable(petition: IPetition): Promise<boolean> {
        return ! await this.signed(petition);
    }
    async signed(petition: IPetition): Promise<boolean> {
        return false;
    }
    async key_manager(idp: IDPManager): Promise<KeyManager<any, any>> {
        return new SemaphoreKeyManager(idp);
    }
}