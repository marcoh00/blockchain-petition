import { SHA256Hash } from "../../shared/merkle";
import { decorateClassWithState, ICredentials, IState } from "./state";
import { IdentityProof, IProofResponse } from "../../shared/idp";

interface ICredentialState {
    working: boolean;
    failed: boolean;
    token?: string;
    response?: IProofResponse;
}

interface ICredentialStateRepository {
    [period: string]: ICredentialState;
}

const CredentialAlreadyRequestedError = Error(
    "Credential for this period was already requested",
);

class IDPManagerBase { }
export class IDPManager extends decorateClassWithState(
    IDPManagerBase,
) {
    id?: string;
    identity?: string;
    credentials: ICredentialStateRepository;
    endpoint: string;
    indefinitely_valid: boolean

    constructor(endpoint: string, indefinitely_valid: boolean = false) {
        super();
        this.endpoint = endpoint;
        this.credentials = {};
        this.indefinitely_valid = indefinitely_valid;
    }

    async stateChanged(state: IState): Promise<void> {
        if (state.identity && state.identity !== this.identity) {
            await this.set_identity(state.identity);
            console.log("IDP new identity/id", state.identity, this.id);
        }
    }

    async set_identity(identity: IdentityProof) {
        this.identity = identity;
        this.id = (
            await SHA256Hash.hashString(
                JSON.stringify({
                    identity: this.identity,
                    idp: this.endpoint,
                }),
            )
        ).toHex();
        this.load();
        this.setState(this.getState());
    }

    registration_data(period: number) {
        if (this.indefinitely_valid) {
            period = 1;
        }
        if (!this.credentials.hasOwnProperty(period))
            this.credentials[period] = {
                working: false,
                failed: false,
            };
        return this.credentials[period];
    }

    async obtain_token(
        period: number,
        client_identity: any,
    ): Promise<string> {
        if (this.indefinitely_valid) {
            period = 1;
        }
        const progress = this.registration_data(period);
        if (progress.working) {
            throw CredentialAlreadyRequestedError;
        }
        progress.working = true;
        progress.failed = false;
        this.setState(this.getState());

        if (typeof (this.credentials[period].token === "undefined")) {
            try {
                const token_or_error = await fetch(`${this.endpoint}/register`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        identity: this.identity,
                        client_identity: client_identity,
                        period: period,
                    }),
                });
                const response = await token_or_error.json();
                console.log("Response from IDP", response);
                if (Object.keys(response).indexOf("error") > -1) {
                    progress.working = false;
                    progress.failed = true;
                    this.stateError(
                        `Ungültige Identität: ${response.error} (HTTP ${token_or_error.status})`,
                    );
                    throw new Error(response.error);
                }
                if (Object.keys(response).indexOf("token") < 0) {
                    progress.working = false;
                    progress.failed = true;
                    this.stateError(
                        `Unerwartete Antwort vom IDP (HTTP ${token_or_error.status})`,
                    );
                    throw new Error("Unerwartete Antwort vom IDP");
                }
                progress.working = false;
                progress.token = response.token;
                await this.save();
                this.setState(this.getState());
                return response.token;
            } catch (e) {
                progress.working = false;
                progress.failed = true;
                throw e;
            }
        } else {
            return progress.token;
        }
    }

    async obtain_credentials(
        period: number,
        validate: (response: any) => boolean = (x) => true,
        current_try: number = 0,
        max_tries: number = 120,
    ): Promise<any> {
        if (this.indefinitely_valid) {
            period = 1;
        }
        const progress = this.registration_data(period);
        progress.working = true;
        this.setState(this.getState());
        const token = progress.token;
        if (typeof token === "undefined" || typeof token === null) {
            throw Error(
                "Cannot obtain credential without token: Invalid state",
            );
        }
        try {
            const proof_or_error = await fetch(`${this.endpoint}/proof`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    token: token,
                }),
            });
            const response = await proof_or_error.json();
            const status = proof_or_error.status;
            console.log("Response from IDP", response);
            if (Object.keys(response).indexOf("error") > -1) {
                if (status === 503) {
                    if (max_tries === 0 || current_try < max_tries) {
                        // Not critical. We can try again later.
                        console.log(
                            `Proof doesn't seem to be ready yet, try again in 10s (${current_try}/${max_tries})`,
                            period,
                            this.endpoint,
                            token,
                        );
                        await new Promise((resolve) =>
                            setTimeout(resolve, 10000),
                        );
                        return await this.obtain_credentials(
                            period,
                            validate,
                            ++current_try,
                            max_tries,
                        );
                    } else {
                        progress.working = false;
                        progress.failed = true;
                        const err = `Proof wasn't ready after trying ${current_try} times`;
                        this.stateError(err);
                        throw Error(err);
                    }
                }
                progress.working = false;
                progress.failed = true;
                this.stateError(`Ungültiges Token (HTTP ${status})`);
                throw new Error(response.error);
            }
            if (!validate(response)) {
                progress.working = false;
                progress.failed = true;
                this.stateError(`Unerwartete Antwort vom IDP (HTTP ${status})`);
                throw new Error("Unerwartete Antwort vom IDP");
            }
            progress.working = false;
            progress.response = response;
            this.save();
            this.setState(this.getState());
            console.log(
                `Successfully obtained credentials for identity ${this.identity} and period ${period}`,
                this.credentials[period],
            );
            return response;
        } catch (e) {
            progress.working = false;
            progress.failed = true;
            this.stateError(`${e}`);
            throw e;
        }
    }

    get storage_id() { return `idp.${this.id}` }

    save() {
        const localData = JSON.stringify({ indefinitely_valid: this.indefinitely_valid, credentials: this.credentials });
        localStorage.setItem(this.storage_id, localData);
        console.log("Credentials saved to localStorage", this.storage_id);
    }

    load() {
        const item = localStorage.getItem(this.storage_id);
        if (typeof item !== "string") return;
        const saved_state = JSON.parse(item);
        this.indefinitely_valid = saved_state.indefinitely_valid;
        this.credentials = saved_state.credentials;
        console.log("IDP, credentials after load", this.credentials, "indefinitely valid?", this.indefinitely_valid);
    }
}
