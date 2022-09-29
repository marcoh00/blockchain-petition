type StringIdentity = string;
type IdentityProof = StringIdentity;

const invalidHex = /[^0-9A-Fa-f]/;

export interface IRegistration {
    identity: StringIdentity;
    ethAccount: string;
    period: number;
}

export interface IProofRequest {
    token: string
}

export const checkRegistration = (registration: IRegistration, minperiod?: number, maxperiod?: number): boolean => {
    if(registration.ethAccount.length != 42) return false;
    //if(invalidHex.test(registration.ethAccount)) return false;
    if(minperiod && maxperiod && (registration.period < minperiod || registration.period > maxperiod)) return false;
    return true;
}

export const checkValidType = (expected_keys: Array<string>, obj: any) => {
    const actual_keys = Object.keys(obj);
    return expected_keys.reduce((prev, current) => prev && actual_keys.includes(current), true);
}