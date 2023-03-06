import Web3 from 'web3';
import { hexToUtf8, hexToBytes, asciiToHex, padLeft } from 'web3-utils';
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
    signed: boolean
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
        const signed = await this.api.eth.accounts.signTransaction(raw_tx, this.privkey!);
        const web3result = await this.api.eth.sendSignedTransaction(signed.rawTransaction!)
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
            const name = await contract.methods.name().call();
            let name_decoded = "";
            try {
                name_decoded = hexToUtf8(name);
            } catch(e) {
                name_decoded = EthereumConnector.hexToUtf8Fallback(name);
            }
            const info: IPetition = {
                address: addr,
                name: name_decoded,
                // Calls functions of the Petition.sol contract
                description: await contract.methods.description().call(),
                id: new Uint8Array(hexToBytes(await contract.methods.id().call())),
                period: Number.parseInt(await contract.methods.period().call()),
                signers: Number.parseInt(await contract.methods.signers().call()),
                signed: !!Number.parseInt(await contract.methods.hasSigned(`${this.account}`).call())
            }
            petitions.push(info);
        }
        return petitions;
    }

    async signPetition(petitionaddr: string) {
        const contract = new this.api.eth.Contract((PetitionContract.abi as any), petitionaddr);
        const tx = await contract.methods.sign().send({ from: this.account });
        return tx;
    }

    async signPetition_zk(petitionaddr: string, proof: any, hpers: SHA256Hash, iteration: number) {
        const contract = new this.api.eth.Contract((PetitionContract.abi as any), petitionaddr);
        console.log(`web3: sign as ${hpers.toHex()} with account ${this.account}`);
        console.log(proof);
        const tx = await contract.methods.sign_zk(Object.values(proof.proof), iteration, `0x${hpers.toHex()}`).send({ from: this.account });
        return tx;
    }

    async createPetition(name: string, description: string, period: number) {
        const name_b32 = padLeft(asciiToHex(name), 64);
        console.log("Create petition", name, name_b32, description, period);
        const tx = await this.registrycontract.methods.createPetition(name_b32, description, period).send({ from: this.account });
        return tx;
    }

    static ASCII_TABLE: ITable = {"20": " ", "21": "!", "22": "\"", "23": "#", "24": "$", "25": "%", "26": "&", "27": "'", "28": "(", "29": ")", "2a": "*", "2b": "+", "2c": ",", "2d": "-", "2e": ".", "2f": "/", "30": "0", "31": "1", "32": "2", "33": "3", "34": "4", "35": "5", "36": "6", "37": "7", "38": "8", "39": "9", "3a": ":", "3b": ";", "3c": "<", "3d": "=", "3e": ">", "3f": "?", "40": "@", "41": "A", "42": "B", "43": "C", "44": "D", "45": "E", "46": "F", "47": "G", "48": "H", "49": "I", "4a": "J", "4b": "K", "4c": "L", "4d": "M", "4e": "N", "4f": "O", "50": "P", "51": "Q", "52": "R", "53": "S", "54": "T", "55": "U", "56": "V", "57": "W", "58": "X", "59": "Y", "5a": "Z", "5b": "[", "5c": "\\", "5d": "]", "5e": "^", "5f": "_", "60": "`", "61": "a", "62": "b", "63": "c", "64": "d", "65": "e", "66": "f", "67": "g", "68": "h", "69": "i", "6a": "j", "6b": "k", "6c": "l", "6d": "m", "6e": "n", "6f": "o", "70": "p", "71": "q", "72": "r", "73": "s", "74": "t", "75": "u", "76": "v", "77": "w", "78": "x", "79": "y", "7a": "z", "7b": "{", "7c": "|", "7d": "}", "7e": "~"};
    static hexToUtf8Fallback(hexstring: string) {
        if(hexstring.length % 2 !== 0) throw Error("Benötige ganze Bytes");
        let output = "";
        for(let i = 0; i < hexstring.length; i += 2) {
            const byte = `${hexstring.charAt(i).toLowerCase()}${hexstring.charAt(i + 1).toLowerCase()}`;
            if(byte === "0x" || byte === "00") continue;
            if(EthereumConnector.ASCII_TABLE.hasOwnProperty(byte)) output = `${output}${EthereumConnector.ASCII_TABLE[byte]}`
            else { console.log("Invalid character", byte) }
        }
        return output;
    }
}

interface ITable {
    [hexbyte: string]: string
}