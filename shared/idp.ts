import { ISemaphoreMerkleInfo } from "./web3";

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

export interface IPssProof {
    sk_icc_1_u: Array<number>
    sk_icc_2_u: Array<number>
    algorithm: string
}

export interface ISemaphoreProofInfo {
    members: Array<bigint>
    merkle: ISemaphoreMerkleInfo
}

export function serialize_semaphore_proof_info(proof: ISemaphoreProofInfo): string {
    return JSON.stringify(proof, (key: string, value: any) => {
        switch (key) {
            case "members":
                return (value as Array<bigint>).map((member) => member.toString());
            case "root":
            case "depth":
            case "size":
                return (value as bigint).toString();
            default:
                return value;
        }
    });
}

export function deserialize_semaphore_proof_info(proof: string): ISemaphoreProofInfo {
    return JSON.parse(proof, (key: string, value: any) => {
        switch (key) {
            case "members":
                return (value as Array<string>).map((member) => BigInt(member));
            case "root":
            case "depth":
            case "size":
                return BigInt(value)
            default:
                return value;
        }
    });
}