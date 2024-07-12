import { SHA256Hash } from "../../shared/merkle";
import { decorateClassWithState, ICredentials, IState } from "./state";
import { WebEthereumConnector } from "./web3";
import { BLOCKTECH_TYPE, BLOCKTECH_TYPES } from '../../shared/addr';
import { IdentityProof, IProofResponse } from "../../shared/idp";

interface ICredentialState {
    working: boolean
    failed: boolean
    token?: string,
    response?: IProofResponse
}

interface ICredentialStateRepository {
    [period: string]: ICredentialState
}

class IDPManagerBase {}
export abstract class IDPManager extends decorateClassWithState(IDPManagerBase) {
    id?: string
    identity?: string
    credentials: ICredentialStateRepository
    endpoint: string

    constructor(endpoint: string) {
        super();
        this.endpoint = endpoint;
    }

    async setIdentity(identity: IdentityProof) {
        this.identity = identity;
        this.id = (await SHA256Hash.hashString(JSON.stringify({
            identity: this.identity,
            idp: this.endpoint
        }))).toHex();
        this.load();
    }

    getRegistrationData(period: number) {
        if(!this.credentials.hasOwnProperty(period)) this.credentials[period] = {
            working: false,
            failed: false
        };
        return this.credentials[period];
    }

    async credentialsForPeriod(period: number) {
        this.getRegistrationData(period).working = true;
        this.getRegistrationData(period).failed = false;
        this.setState(this.getState());

        await this.ensureKeysAvailable(period);
        
        let endpoint: string = await this.getState().connector.url();
        let client_identity: string;
        if (this.getState().connector.blockchaintype === BLOCKTECH_TYPES.mit_zk) {
            client_identity = this.credentials[period].pubkey.toHex();
        } else {
            client_identity = this.getState().repository.connector.account;
        }
        
        if(typeof(this.credentials[period].token === "undefined")) {
            const token_or_error = await fetch(`${endpoint}/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    identity: this.identity,
                    client_identity: client_identity,
                    period: period
                })
            });
            const response = await token_or_error.json();
            console.log("Response from IDP", response);
            if(Object.keys(response).indexOf("error") > -1) {
                this.getRegistrationData(period).working = false;
                this.getRegistrationData(period).failed = true;
                this.stateError(`Ungültige Identität: ${response.error} (HTTP ${token_or_error.status})`);
                throw new Error(response.error);
            }
            if(Object.keys(response).indexOf("token") < 0) {
                this.getRegistrationData(period).working = false;
                this.getRegistrationData(period).failed = true;
                this.stateError(`Unerwartete Antwort vom IDP (HTTP ${token_or_error.status})`);
                throw new Error("Unerwartete Antwort vom IDP");
            }
            this.getRegistrationData(period).working = false;
            this.getRegistrationData(period).token = response.token;
            this.setState(this.getState());
            await this.save();
        }

        if(typeof(this.getRegistrationData(period).credentials) === "undefined") {
            await this.tryObtainCredentials(period, endpoint);
            return;
        }
    }

    async tryObtainCredentials(period: number, endpoint: string) {
        this.getRegistrationData(period).working = true;
        this.setState(this.getState());
        const token = this.credentials[period].token;
        const proof_or_error = await fetch(`${endpoint}/proof`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                token: token
            })
        });
        const response = await proof_or_error.json();
        const status = proof_or_error.status;
        console.log("Response from IDP", response);
        if(Object.keys(response).indexOf("error") > -1) {
            if(status === 503) {
                // Not critical. We can try again later.
                console.log("Proof doesn't seem to be ready yet, try again in 10s", period, endpoint, token);
                setTimeout(() => this.tryObtainCredentials(period, endpoint), 10000);
                return;
            }
            this.getRegistrationData(period).working = false;
            this.getRegistrationData(period).failed = true;
            this.stateError(`Ungültiges Token (HTTP ${status})`);
            throw new Error(response.error);
        }
        const keys = Object.keys(response);
        if(keys.indexOf("hash") < 0 || keys.indexOf("iteration") < 0 || keys.indexOf("period") < 0 || keys.indexOf("proof") < 0) {
            this.getRegistrationData(period).working = false;
            this.getRegistrationData(period).failed = true;
            this.stateError(`Unerwartete Antwort vom IDP (HTTP ${status})`);
            throw new Error("Unerwartete Antwort vom IDP");
        }
        this.getRegistrationData(period).credentials = response as ICredentials;
        this.getRegistrationData(period).working = false;
        this.setState(this.getState());
        this.save();
        console.log(`Successfully obtained credentials for identity ${this.identity} and period ${period}`, this.credentials[period]);
    }

    save() {
        const localData = JSON.stringify(
            this.credentials,
            (key, value) => {if(typeof(value) === "object" && value.hasOwnProperty("hash") && typeof(value.hash) !== "string") {console.log("hashy value", value); return (value as SHA256Hash).toHex();} return value;}
        );
        localStorage.setItem(`cred.${this.identity}`, localData);
        SHA256Hash.hashString
        console.log("Credentials saved to localStorage");
    }

    load() {
        const item = localStorage.getItem(`cred.${this.identity}`);
        if(typeof(item) !== "string") return;
        try {
            this.credentials = JSON.parse(
                item, (key, value) => typeof(value) === "string" && value.length === 64 && (key === "pubkey" || key === "privkey")  ? SHA256Hash.fromHex(value) : value
            );
        } catch(e) {
            this.stateError(`Konnte zwischengespeicherte Login-Daten nicht abrufen: ${e}`);
        }
        console.log("IDP, credentials after load", this.credentials);
    }
}

let idpmanager: IDPManager = null;
export function getIDPManager(identity: string, credentials?: ICredentialRepository, cache: boolean = false): IDPManager {
    if(idpmanager === null
        || idpmanager.identity !== identity) idpmanager = new IDPManager(identity, credentials, cache);
    return idpmanager;
}