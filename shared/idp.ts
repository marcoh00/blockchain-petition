export type StringIdentity = string;
export type IdentityProof = StringIdentity;

export interface IRegistration {
    identity: IdentityProof;
    client_identity: string;
    period: number;
}

export interface IProofRequest {
    token: string
}

export function checkValidType(expected_keys: Array<string>, obj: any): boolean {
    const actual_keys = Object.keys(obj);
    return expected_keys.reduce((prev, current) => prev && actual_keys.includes(current), true);
}

export interface IProofResponse {
    period: number
    iteration?: number
    proof?: any
    hash?: string
}
