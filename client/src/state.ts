import { LitElement } from "lit";
import { REGISTRY_CONTRACT } from "../../shared/addr";
import { MerkleProof, SHA256Hash } from "../../shared/merkle";
import { EthereumConnector } from "../../shared/web3";
import { Web3Repository } from "./web3repository";
import { ZokratesHelper } from "./zokrates";

interface ICredentials {
    hash: string,
    iteration: number,
    period: number,
    proof: MerkleProof,
}

interface IZokratesState {
    helper?: ZokratesHelper,
    initialized: boolean,
    text?: string
}

export interface IState {
    registry: string,
    period: number,
    customPeriod: boolean,
    identity: string,
    pubkey?: SHA256Hash,
    privkey?: SHA256Hash,
    web3connected: boolean,
    connector?: EthereumConnector,
    repository?: Web3Repository,
    token?: string,
    credentials?: ICredentials,
    zokrates: IZokratesState,
    error?: string
}

export interface IStateAccessor {
    getState: () => IState
    setState: (state: IState) => void
}

let state: IState = undefined;

function localGetState(): IState {
    if(state === undefined) {
        console.log("Initialize new state");
        console.trace();
        localSetState({
            registry: REGISTRY_CONTRACT,
            period: -1,
            customPeriod: false,
            identity: "",
            web3connected: false,
            zokrates: {
                initialized: false,
                text: undefined,
                helper: undefined
            }
        })
    }
    return state;
}

const decoratedClasses: Array<any> = [];

function localSetState(lstate: IState) {
    console.log("Set State", lstate);
    console.trace();
    state = lstate;
    for(let decoratedClass of decoratedClasses) {
        decoratedClass.stateChanged(lstate);
    }
}

type ClassType = new (...args: any[]) => any;

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
        stateError(message: string, timeout: number = 10000) {
            console.log("[ERROR] " + message);
            this.setState({
                ...this.getState(),
                error: message
            });
            setTimeout(() => this.setState({
                ...this.getState(),
                error: undefined
            }), timeout);
        }
    }
}

export function getStateAccessors(): IStateAccessor {
    return {
        getState: localGetState,
        setState: localSetState
    };
}