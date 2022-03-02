import Web3 from 'web3';
import { Contract } from 'web3-eth-contract';
import IDPContract from "../platform/artifacts/contracts/IDP.sol/IDP.json";
import RegistryContract from "../platform/artifacts/contracts/Registry.sol/Registry.json";

export class EthereumConnector {
    api: Web3
    registryaddr: string
    registrycontract: Contract
    idpcontract: Contract
    account?: string
    privkey?: string

    constructor(provider: any, registryaddr: string, account?: string, privkey?: string) {
        console.log("Init Web3 with provider", provider);
        this.api = new Web3(provider);
        this.registryaddr = registryaddr;
        this.account = account;
        this.privkey = privkey;
    }

    async init() {
        this.registrycontract = new this.api.eth.Contract((RegistryContract.abi as any), this.registryaddr);
        const idpaddr = await this.registrycontract.methods.idp().call();
        console.log("🌐 Obtained IDP contract address", idpaddr);
        this.idpcontract = new this.api.eth.Contract((IDPContract.abi as any), idpaddr);
    }

    async submitHash(hash: string, period: number): Promise<number> {
        const web3result: Promise<any> = this.idpcontract.methods.submitHash(`0x${hash}`, period).send({
            from: this.account
        })
        return web3result.then(tx => Number.parseInt(tx.events.HashAdded.returnValues.iteration));
    }

    async period(): Promise<number> {
        return Number.parseInt(await this.idpcontract.methods.period().call());
    }

    async depth(): Promise<number> {
        return Number.parseInt(await this.idpcontract.methods.depth().call());
    }

    async startPeriod(period?: number): Promise<number> {
        if(period === undefined) {
            period = await this.period();
        }
        return Number.parseInt(await this.idpcontract.methods.start_period(period).call());
    }

    async nextPeriod(period?: number): Promise<number> {
        if(period === undefined) {
            period = await this.period();
        }
        return await this.startPeriod(period + 1);
    }

    async lastIteration(): Promise<number> {
        return Number.parseInt(await this.idpcontract.methods.lastIteration().call());
    }

    async periodlen(): Promise<number> {
        return Number.parseInt(await this.idpcontract.methods.periodlen().call());
    }

    async interval(): Promise<number> {
        return await this.periodlen() / 254;
    }

    async url(): Promise<string> {
        return await this.idpcontract.methods.url().call();
    }
}