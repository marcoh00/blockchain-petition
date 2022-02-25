import { LitElement } from "lit";

export interface IState {
    period: number
    identity: string
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
            identity: ""
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