import Web3 from 'web3';
import { Contract } from 'web3-eth-contract';
import IDPContract from "../../platform/artifacts/contracts/IDP.sol/IDP.json";

export class EthereumConnector {
    api: Web3
    contract: Contract
    account?: string
    privkey?: string

    constructor(url: string, idpcontract: string, account?: string, privkey?: string) {
        this.api = new Web3(url);
        this.contract = new this.api.eth.Contract((IDPContract.abi as any), idpcontract);
        this.account = account;
        this.privkey = privkey;
    }

    async period(): Promise<number> {
        return Number.parseInt(await this.contract.methods.period().call());
    }

    async depth(): Promise<number> {
        return Number.parseInt(await this.contract.methods.depth().call());
    }

    async startPeriod(period: number): Promise<number> {
        return Number.parseInt(await this.contract.methods.start_period(period).call());
    }

    async nextPeriod(current_period?: number): Promise<number> {
        if(current_period === undefined) {
            current_period = await this.period();
        }
        return await this.startPeriod(current_period + 1);
    }

    async lastIteration(): Promise<number> {
        return Number.parseInt(await this.contract.methods.lastIteration().call());
    }

    async periodlen(): Promise<number> {
        return Number.parseInt(await this.contract.methods.periodlen().call());
    }

    async interval(): Promise<number> {
        return await this.periodlen() / 254;
    }
}