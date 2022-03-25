import { SHA256Hash } from "../../shared/merkle";
import { decorateClassWithState, ICredentials, IState } from "./state";
import { WebEthereumConnector } from "./web3";

interface IRegistrationData {
    working: boolean
    failed: boolean
    token?: string
    credentials?: ICredentials
}

interface ICredentialRepository {
    [period: string]: IRegistrationData
}

class IDPManagerBase {}
export class IDPManager extends decorateClassWithState(IDPManagerBase) {
    identity: string
    privkey: SHA256Hash
    pubkey: SHA256Hash
    credentials: ICredentialRepository

    working: boolean
    failed: boolean

    constructor(identity: string, privkey: SHA256Hash, pubkey: SHA256Hash, credentials: ICredentialRepository) {
        super();
        this.identity = identity;
        this.privkey = privkey;
        this.pubkey = pubkey;
        this.credentials = credentials;
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

        
        const endpoint = await this.getState().connector.url();
        if(typeof(this.credentials[period].token === "undefined")) {
            const token_or_error = await fetch(`${endpoint}/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    identity: this.identity,
                    pubkey: this.pubkey.toHex(),
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

    async save() {
        const localData = JSON.stringify({
            privkey: this.privkey.toHex(),
            pubkey: this.pubkey.toHex(),
            credentials: this.credentials
        });
        localStorage.setItem(`cred.${this.identity}`, localData);
        console.log("Credentials saved to localStorage");
    }
}

let idpmanager: IDPManager = null;
export function getIDPManager(identity: string, privkey: SHA256Hash, pubkey: SHA256Hash, credentials: ICredentialRepository = {}): IDPManager {
    if(idpmanager === null
        || idpmanager.identity !== identity
        || !idpmanager.pubkey.equals(pubkey)
        || !idpmanager.privkey.equals(privkey)) idpmanager = new IDPManager(identity, privkey, pubkey, credentials);
    return idpmanager;
}