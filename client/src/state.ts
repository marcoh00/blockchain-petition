import { REGISTRY_CONTRACT } from "../../shared/addr";
import { MerkleProof, SHA256Hash } from "../../shared/merkle";
import { IDPManager } from "./idp";
import { WalletConnector } from "./web3";
import { Web3Repository } from "./web3repository";
import { ZokratesHelper } from "./zokrates";
import { KeyManager } from "./keys";
import { IClientProvider } from "./provider";
import { IdentityProof } from "../../shared/idp";
import { html } from "lit";

export interface ICredentials {
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
    identity?: IdentityProof,
    connector?: WalletConnector,
    repository?: Web3Repository,
    idp?: IDPManager,
    keymanager?: KeyManager<any, any>,
    provider?: IClientProvider,
    error?: Array<string>,
    locktext?: string,
    lockspinner: boolean
}

export interface IStateAccessor {
    getState: () => IState
    setState: (state: IState) => void
}
/**
 * Global genutzer State!
 */
let state: IState = undefined;

function localGetState(): IState {
    if (state === undefined) {
        console.log("Initialize new state");
        localSetState({
            registry: REGISTRY_CONTRACT,
            period: -1,
            customPeriod: false,
            lockspinner: true
        })
    }
    return state;
}

const decoratedClasses: Array<any> = [];

function localSetState(lstate: IState) {
    // console.trace("Set State", lstate);
    state = lstate;
    for (let decoratedClass of decoratedClasses) {
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
        async stateChanged(state: IState) { }
        stateError(message: string, e?: Error, timeout: number = 10000) {
            if (!e) e = ({} as unknown as Error);
            console.trace("[ERROR] " + message, e);
            let messages = [message];
            if (e.hasOwnProperty("message")) {
                messages.push(e.message);
            }
            if (e.hasOwnProperty("stack")) {
                messages.push(e.stack);
            }
            this.setState({
                ...this.getState(),
                error: messages
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