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
    chainid?: number

    constructor(provider: any, registryaddr: string, account?: string, privkey?: string, chainid?: number) {
        if(Array.isArray(provider) && provider.length === 5) [provider, registryaddr, account, privkey, chainid] = provider;
        this.api = new Web3(provider);
        this.registryaddr = registryaddr;
        this.account = account;
        this.privkey = privkey;
        this.chainid = chainid;
    }

    async init() {
        const wallet_chain_id = await this.api.eth.getChainId()
        if(this.chainid && wallet_chain_id !== this.chainid) throw new Error(`Falsche Blockchain ausgewählt (ist ${wallet_chain_id}, soll ${this.chainid})`);
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

    async submitHash(hash: string, period: number): Promise<object> {
        const method = this.idpcontract.methods.submitHash(`0x${hash}`, period);
        const data = method.encodeABI();
        const gas = await method.estimateGas();
        const raw_tx = {
            from: this.account,
            to: await this.registrycontract.methods.idp().call(),
            data,
            gas
        };
        console.log("Transaction", raw_tx);
        const signed = await this.api.eth.accounts.signTransaction(raw_tx, this.privkey);
        const web3result = await this.api.eth.sendSignedTransaction(signed.rawTransaction)
        console.log("web3result", web3result);
        console.log("events", web3result.logs[0].topics);
        return web3result;
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

    async signPetition(petitionaddr: string, proof: any, hpers: SHA256Hash, iteration: number) {
        const contract = new this.api.eth.Contract((PetitionContract.abi as any), petitionaddr);
        console.log(`web3: sign as ${hpers.toHex()} with account ${this.account}`);
        console.log(proof);
        const tx = await contract.methods.sign(Object.values(proof.proof), iteration, `0x${hpers.toHex()}`).send({ from: this.account });
        return tx;
    }
}