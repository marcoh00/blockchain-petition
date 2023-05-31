type StringIdentity = string;
type IdentityProof = StringIdentity;
import { BLOCKTECH_TYPE, BLOCKTECH_TYPES } from '../../shared/addr';

const invalidHex = /[^0-9A-Fa-f]/;

export interface IRegistration {
    identity: StringIdentity;
    client_identity: string;
    period: number;
}

export interface IProofRequest {
    token: string
}

export const checkRegistration = (registration: IRegistration, idpType: BLOCKTECH_TYPES, 
    minperiod?: number, maxperiod?: number,): boolean => {
    if (idpType === BLOCKTECH_TYPES.ohne_zk) {
        if(registration.client_identity.length != 42) return false;
    }
    if (idpType === BLOCKTECH_TYPES.mit_zk) {
        if(registration.client_identity.length != 64) return false;
        if(invalidHex.test(registration.client_identity)) return false;
    }
    if(minperiod && maxperiod && (registration.period < minperiod || registration.period > maxperiod)) return false;
    return true;
}

export const checkValidType = (expected_keys: Array<string>, obj: any) => {
    const actual_keys = Object.keys(obj);
    return expected_keys.reduce((prev, current) => prev && actual_keys.includes(current), true);
}