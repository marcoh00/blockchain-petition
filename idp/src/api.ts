type StringIdentity = string;
type IdentityProof = StringIdentity;

export interface IRegistration {
    identity: StringIdentity;
    pubkey: string;
    period: number;
}

export const checkRegistration = (registration: IRegistration, minperiod?: number, maxperiod?: number): boolean => {
    if(!registration.pubkey.startsWith("0x")) return false;
    if(registration.pubkey.length != 34) return false;
    if(minperiod && maxperiod && (registration.period < minperiod || registration.period > maxperiod)) return false;
    return true;
}

export const checkValidType = (expected_keys: Array<string>, obj: any) => {
    const actual_keys = Object.keys(obj);
    return expected_keys.reduce((prev, current) => prev && actual_keys.includes(current), true);
}