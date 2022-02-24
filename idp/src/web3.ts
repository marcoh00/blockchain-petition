import Web3 from 'web3';
import { Contract } from 'web3-eth-contract';
import IDPContract from "../../platform/artifacts/contracts/IDP.sol/IDP.json";

export class EthereumConnector {
    api: Web3
    contract: Contract
    account?: string
    privkey?: string

    constructor(url: string, idpcontract: string, account: string, privkey: string) {
        this.api = new Web3(url);
        this.contract = new this.api.eth.Contract((IDPContract.abi as any), idpcontract);
        this.account = account;
        this.privkey = privkey;
    }

    async submitHash(hash: string, period: number): Promise<number> {
        const web3result: Promise<any> = this.contract.methods.submitHash(`0x${hash}`, period).send({
            from: this.account
        })
        return web3result.then(tx => Number.parseInt(tx.events.HashAdded.returnValues.iteration));
    }

    async period(): Promise<number> {
        return Number.parseInt(await this.contract.methods.period().call());
    }

    async depth(): Promise<number> {
        return Number.parseInt(await this.contract.methods.depth().call());
    }

    async startPeriod(period?: number): Promise<number> {
        if(period === undefined) {
            period = await this.period();
        }
        return Number.parseInt(await this.contract.methods.start_period(period).call());
    }

    async nextPeriod(period?: number): Promise<number> {
        if(period === undefined) {
            period = await this.period();
        }
        return await this.startPeriod(period + 1);
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