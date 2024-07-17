import { SHA256Hash } from "../../shared/merkle";
import { IPetition, NaiveEthereumConnector, ZKEthereumConnector } from "../../shared/web3";
import { IDPManager } from "./idp";
import { IZKKey, IZKProofResponse, KeyManager, NaiveKeyManager, NoEntryError, ZKKeyManager } from "./keys";
import { decorateClassWithState } from "./state";
import { ZokratesHelper } from "./zokrates";


export interface IClientProvider {
    sign(petition: IPetition): Promise<void>;
    signable(petition: IPetition): Promise<boolean>
    signed(petition: IPetition): Promise<boolean>
    key_manager(idp: IDPManager): KeyManager<any, any>
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

    key_manager(idp: IDPManager): KeyManager<any, any> {
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

    key_manager(idp: IDPManager): KeyManager<any, any> {
        return new NaiveKeyManager(idp);
    }

    async ensure_registered(period: number) {
        // We just want the exception here if we haven't got any proof that we're allowed to sign:
        const hash_added = await this.keymanager.get_proof(period);
        if (hash_added.period != period) throw Error("Should never happen");
    }
}