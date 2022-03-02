import { LitElement } from "lit";
import { MerkleProof, SHA256Hash } from "../../shared/merkle";
import { EthereumConnector } from "../../shared/web3";

interface ICredentials {
    hash: string,
    iteration: number,
    period: number,
    proof: MerkleProof
}

export interface IState {
    period: number
    identity: string,
    pubkey?: SHA256Hash,
    privkey?: SHA256Hash,
    web3connected: boolean,
    connector?: EthereumConnector,
    token?: string,
    credentials?: ICredentials,
    error?: string
}

export interface IStateAccessor {
    getState: () => IState
    setState: (state: IState) => void
}

let state: IState = undefined;

function localGetState(): IState {
    if(state === undefined) {
        localSetState({
            period: -1,
            identity: "",
            web3connected: false
        })
    }
    return state;
}

const decoratedClasses: Array<any> = [];

function localSetState(lstate: IState) {
    state = lstate;
    for(let decoratedClass of decoratedClasses) {
        decoratedClass.stateChanged(lstate);
    }
}

type ClassType = new (...args: any[]) => LitElement;

export function decorateClassWithState<T extends ClassType>(decorated: T) {
    return class extends decorated implements IStateAccessor {
        constructor(...args: any[]) {
            super(args);
            decoratedClasses.push(this);
        }
        getState: () => IState = localGetState;
        setState: (state: IState) => void = localSetState;
        async stateChanged(state: IState) {
            console.log("State Change", this, state);
        }
    }
}

export function getStateAccessors(): IStateAccessor {
    return {
        getState: localGetState,
        setState: localSetState
    };
}