import Web3 from 'web3';
import { hexToUtf8, hexToBytes } from 'web3-utils';
import { Contract } from 'web3-eth-contract';
import IDPContract from "../platform/artifacts/contracts/IDP.sol/IDP.json";
import RegistryContract from "../platform/artifacts/contracts/Registry.sol/Registry.json";
import PetitionContract from "../platform/artifacts/contracts/Petition.sol/Petition.json";
import { SHA256Hash } from './merkle';

export interface IPetition {
    address: string
    name: string
    description: string
    id: Uint8Array
    period: number
    signers: number
}

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

        if(typeof(this.account) === "undefined") {
            const accounts = await this.api.eth.getAccounts();
            console.log("web3: no account specified, try to get accounts via api", accounts);
            if(accounts.length > 0) {
                this.account = accounts[0];
            }
        }
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

    async petitions(): Promise<IPetition[]> {
        const petitions: IPetition[] = [];
        const addr_list: string[] = await this.registrycontract.methods.petitions().call();
        for(const addr of addr_list) {
            const contract = new this.api.eth.Contract((PetitionContract.abi as any), addr);
            const info: IPetition = {
                address: addr,
                name: hexToUtf8(await contract.methods.name().call()),
                description: await contract.methods.description().call(),
                id: new Uint8Array(hexToBytes(await contract.methods.id().call())),
                period: Number.parseInt(await contract.methods.period().call()),
                signers: Number.parseInt(await contract.methods.signers().call())
            }
            petitions.push(info);
        }
        return petitions;
    }

    async signPetition(petitionaddr: string, proof: Uint8Array, hpers: SHA256Hash, iteration: number) {
        const contract = new this.api.eth.Contract((PetitionContract.abi as any), petitionaddr);
        console.log(`web3: sign as ${hpers.toHex()} with account ${this.account}`);
        return await contract.methods.sign(proof, iteration, `0x${hpers.toHex()}`).send({ from: this.account });
    }
}