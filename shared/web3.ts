import Web3 from 'web3';
import { hexToUtf8, hexToBytes, asciiToHex, padLeft } from 'web3-utils';
import { Contract, EventData } from 'web3-eth-contract';
import RegistryContract from "../platform/artifacts/contracts/Registry.sol/Registry.json";
import NaiveIDPContract from "../platform/artifacts/contracts/IDP.sol/NaiveIDP.json";
import ZKIDPContract from "../platform/artifacts/contracts/IDP.sol/ZKIDP.json";
import PssIDPContract from "../platform/artifacts/contracts/IDP.sol/PSSIDP.json";
import SemaphoreIDPContract from "../platform/artifacts/contracts/IDP.sol/SemaphoreIDP.json";
import NaivePetitionContract from "../platform/artifacts/contracts/Petition.sol/NaivePetition.json";
import ZKPetitionContract from "../platform/artifacts/contracts/Petition.sol/ZKPetition.json";
import PssPetitionContract from "../platform/artifacts/contracts/Petition.sol/PSSPetition.json";
import SemaphorePetitionContract from "../platform/artifacts/contracts/Petition.sol/SemaphorePetition.json";
import IPssVerifier from "../platform/artifacts/contracts/IPssVerifier.sol/IPssVerifier.json"
import { SHA256Hash } from './merkle';

export interface IPetition {
    address: string
    name: string
    description: string
    id: Uint8Array
    period: number
    signers: number
    signable?: boolean
}

export interface ISemaphoreMerkleInfo {
    root: bigint
    depth: bigint
    size: bigint
}

export async function getWeb3Connector(provider: any, registryaddr: string, account?: string, privkey?: string, chainid?: number): Promise<EthereumConnector> {
    if (Array.isArray(provider) && provider.length === 6) {
        // Alle übergebenen Argumente von der decorateClassWithWeb3 Klasse sind
        // nur in provider paramenter und müssen entpackt werden
        // Grund: Kein Constructor overloading in typescript!
        [provider, registryaddr, account, privkey, chainid] = provider;
    }
    const web3 = new Web3(provider);
    const registry = new web3.eth.Contract((RegistryContract.abi as any), registryaddr);
    const regtype = Number.parseInt(await registry.methods.petitiontype().call()) as PetitionType;

    let ethereum_connector: EthereumConnector | null = null;
    switch (regtype) {
        case PetitionType.Naive: {
            ethereum_connector = new NaiveEthereumConnector(web3, registry, account, privkey, chainid);
            break;
        }
        case PetitionType.ZK: {
            ethereum_connector = new ZKEthereumConnector(web3, registry, account, privkey, chainid);
            break;
        }
        case PetitionType.PSSSecp256k1: {
            ethereum_connector = new PssEthereumConnector(web3, registry, account, privkey, chainid);
            break;
        }
        case PetitionType.PSSAltBn128: {
            ethereum_connector = new PssEthereumConnector(web3, registry, account, privkey, chainid);
            break;
        }
        case PetitionType.Semaphore: {
            ethereum_connector = new SemaphoreEthereumConnector(web3, registry, account, privkey, chainid);
            break;
        }
        default: throw Error(`Unknown petition type ${regtype}`);

    }
    await ethereum_connector.init();
    return ethereum_connector;
}

export abstract class EthereumConnector {
    api: Web3
    registrycontract: Contract
    idpcontract: Contract
    account?: string
    privkey?: string
    chainid?: number

    constructor(provider: Web3, registry: Contract, account?: string, privkey?: string, chainid?: number) {
        this.api = provider;
        this.registrycontract = registry;
        this.account = account;
        this.privkey = privkey;
        this.chainid = chainid;
    }

    async init() {
        const wallet_chain_id = await this.api.eth.getChainId()
        if (this.chainid && wallet_chain_id !== this.chainid) throw new Error(`Falsche Blockchain ausgewählt (ist ${wallet_chain_id}, soll ${this.chainid})`);
        const idpaddr = await this.registrycontract.methods.idp().call();
        console.log("🌐 Obtained IDP contract address", idpaddr);
        this.idpcontract = this.idp(idpaddr);

        if (typeof (this.account) === "undefined") {
            const accounts = await this.api.eth.getAccounts();
            console.log("web3: no account specified, try to get accounts via api", accounts);
            if (accounts.length > 0) {
                this.account = accounts[0];
            }
        }
    }

    async period(): Promise<number> {
        return Number.parseInt(await this.idpcontract.methods.period().call());
    }

    async startPeriod(period?: number): Promise<number> {
        if (period === undefined) {
            period = await this.period();
        }
        return Number.parseInt(await this.idpcontract.methods.start_period(period).call());
    }

    async nextPeriod(period?: number): Promise<number> {
        if (period === undefined) {
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
        for (const addr of addr_list) {
            const contract = this.petition(addr);
            const name = await contract.methods.name().call();
            let name_decoded = "";
            try {
                name_decoded = hexToUtf8(name);
            } catch (e) {
                name_decoded = EthereumConnector.hexToUtf8Fallback(name);
            }
            const info: IPetition = {
                address: addr,
                name: name_decoded,
                // Calls functions of the Petition.sol contract
                description: await contract.methods.description().call(),
                id: new Uint8Array(hexToBytes(await contract.methods.id().call())),
                period: Number.parseInt(await contract.methods.period().call()),
                signers: Number.parseInt(await contract.methods.signers().call())
            }
            petitions.push(info);
        }
        return petitions;
    }

    async createPetition(name: string, description: string, period: number) {
        const name_b32 = padLeft(asciiToHex(name), 64);
        console.log("Create petition", name, name_b32, description, period, this.account);
        const tx = await this.registrycontract.methods.createPetition(name_b32, description, period).send({ from: this.account });
        return tx;
    }

    static ASCII_TABLE: ITable = { "20": " ", "21": "!", "22": "\"", "23": "#", "24": "$", "25": "%", "26": "&", "27": "'", "28": "(", "29": ")", "2a": "*", "2b": "+", "2c": ",", "2d": "-", "2e": ".", "2f": "/", "30": "0", "31": "1", "32": "2", "33": "3", "34": "4", "35": "5", "36": "6", "37": "7", "38": "8", "39": "9", "3a": ":", "3b": ";", "3c": "<", "3d": "=", "3e": ">", "3f": "?", "40": "@", "41": "A", "42": "B", "43": "C", "44": "D", "45": "E", "46": "F", "47": "G", "48": "H", "49": "I", "4a": "J", "4b": "K", "4c": "L", "4d": "M", "4e": "N", "4f": "O", "50": "P", "51": "Q", "52": "R", "53": "S", "54": "T", "55": "U", "56": "V", "57": "W", "58": "X", "59": "Y", "5a": "Z", "5b": "[", "5c": "\\", "5d": "]", "5e": "^", "5f": "_", "60": "`", "61": "a", "62": "b", "63": "c", "64": "d", "65": "e", "66": "f", "67": "g", "68": "h", "69": "i", "6a": "j", "6b": "k", "6c": "l", "6d": "m", "6e": "n", "6f": "o", "70": "p", "71": "q", "72": "r", "73": "s", "74": "t", "75": "u", "76": "v", "77": "w", "78": "x", "79": "y", "7a": "z", "7b": "{", "7c": "|", "7d": "}", "7e": "~" };
    static hexToUtf8Fallback(hexstring: string) {
        if (hexstring.length % 2 !== 0) throw Error("Benötige ganze Bytes");
        let output = "";
        for (let i = 0; i < hexstring.length; i += 2) {
            const byte = `${hexstring.charAt(i).toLowerCase()}${hexstring.charAt(i + 1).toLowerCase()}`;
            if (byte === "0x" || byte === "00") continue;
            if (EthereumConnector.ASCII_TABLE.hasOwnProperty(byte)) output = `${output}${EthereumConnector.ASCII_TABLE[byte]}`
            else { console.log("Invalid character", byte) }
        }
        return output;
    }

    abstract petitiontype(): PetitionType;
    abstract idp(addr: string): Contract;
    abstract petition(addr: string): Contract;
}

interface ITable {
    [hexbyte: string]: string
}

export class ZKEthereumConnector extends EthereumConnector {
    constructor(provider: Web3, registry: Contract, account?: string, privkey?: string, chainid?: number) {
        super(provider, registry, account, privkey, chainid);
    }

    async signPetition_zk(petitionaddr: string, proof: any, hpers: SHA256Hash, iteration: number) {
        const contract = this.petition(petitionaddr);
        console.log(`web3: sign as ${hpers.toHex()} with account ${this.account}`);
        console.log(proof);
        const tx = await contract.methods.sign(Object.values(proof.proof), iteration, `0x${hpers.toHex()}`).send({ from: this.account });
        return tx;
    }

    async hasSigned_zk(petitionaddr: string, hpers: SHA256Hash): Promise<boolean> {
        const contract = this.petition(petitionaddr);
        return await contract.methods.hasSigned(`0x${hpers.toHex()}`).call();
    }

    async depth(): Promise<number> {
        return Number.parseInt(await this.idpcontract.methods.depth().call());
    }

    async submitHash_zk(client_identity: string, period: number): Promise<EventData> {
        /**
         * @param {string} client_identity - Dies ist in zk die Identität die in der client Maske Eingetragen wurde.
         * In Ohne Zk ist es der Ethereum Account 
         */
        let method = this.idpcontract.methods.submitHash(`0x${client_identity}`, period);
        const data = method.encodeABI();
        const gas = await method.estimateGas({ from: this.account });
        const raw_tx = {
            from: this.account,
            to: await this.registrycontract.methods.idp().call(),
            data,
            gas
        };
        console.log("Transaction", raw_tx);
        const signed = await this.api.eth.accounts.signTransaction(raw_tx, this.privkey!);
        const web3result = await this.api.eth.sendSignedTransaction(signed.rawTransaction!);

        // Man holt sich den "iteration" Wert von der Block chain. Dieser Wert steht im Event der 
        // von der vorherigen Tansaktion emitiert wurde (Event vom submitHash smart contract)
        const event = await this.idpcontract.getPastEvents("HashAdded", { filter: { transactionHash: web3result.transactionHash } });
        if (event.length > 1) {
            console.error(event);
        }
        return event[0];
    }

    petitiontype(): PetitionType {
        return PetitionType.ZK;
    }
    idp(addr: string): Contract {
        return new this.api.eth.Contract((ZKIDPContract.abi as any), addr);
    }
    petition(addr: string): Contract {
        return new this.api.eth.Contract((ZKPetitionContract.abi as any), addr);
    }
}

export class NaiveEthereumConnector extends EthereumConnector {
    constructor(provider: Web3, registry: Contract, account?: string, privkey?: string, chainid?: number) {
        super(provider, registry, account, privkey, chainid);
    }

    async signPetition(petitionaddr: string) {
        const contract = this.petition(petitionaddr);
        const tx = await contract.methods.sign().send({ from: this.account });
        return tx;
    }

    async hasSigned(petitionaddr: string): Promise<boolean> {
        const contract = this.petition(petitionaddr);
        return await contract.methods.hasSigned(`${this.account}`).call();
    }

    async submitHash(client_identity: string, period: number) {
        let method = this.idpcontract.methods.submitVotingRight(`${client_identity}`, period);
        const data = method.encodeABI();
        const gas = await method.estimateGas({ from: this.account });
        const to = await this.registrycontract.methods.idp().call();
        const raw_tx = {
            from: this.account,
            to,
            data,
            gas
        };
        console.log("Transaction", raw_tx);
        const signed = await this.api.eth.accounts.signTransaction(raw_tx, this.privkey!);
        console.log("Signed Transaction", raw_tx);
        await this.api.eth.sendSignedTransaction(signed.rawTransaction!);
    }

    async interval(): Promise<number> {
        // Once per slot
        return 12;
    }

    petitiontype(): PetitionType {
        return PetitionType.Naive;
    }

    idp(addr: string): Contract {
        return new this.api.eth.Contract((NaiveIDPContract.abi as any), addr);
    }

    petition(addr: string): Contract {
        return new this.api.eth.Contract((NaivePetitionContract.abi as any), addr);
    }
}

export class PssEthereumConnector extends EthereumConnector {
    pk_m_x: Array<number>
    pk_m_y: Array<number>
    pk_icc_x: Array<number>
    pk_icc_y: Array<number>
    pk_sector_x: Array<number>
    pk_sector_y: Array<number>
    _petitiontype: PetitionType

    constructor(provider: Web3, registry: Contract, account?: string, privkey?: string, chainid?: number) {
        super(provider, registry, account, privkey, chainid);
    }

    async interval(): Promise<number> {
        return 864000;
    }

    get pk_m(): Uint8Array {
        return new Uint8Array([4].concat(this.pk_m_x).concat(this.pk_m_y));
    }

    get pk_icc(): Uint8Array {
        return new Uint8Array([4].concat(this.pk_icc_x).concat(this.pk_icc_y));
    }

    get pk_sector(): Uint8Array {
        return new Uint8Array([4].concat(this.pk_sector_x).concat(this.pk_sector_y))
    }

    async init(): Promise<void> {
        await super.init();
        const verifier_address = await this.registrycontract.methods.verifier().call();
        console.log(`Verifier is at ${verifier_address}`);
        const verifier = new this.api.eth.Contract((IPssVerifier.abi as any), verifier_address);
        const gpk = await verifier.methods.get_gpk().call();
        this.pk_m_x = bn2uint8(BigInt(gpk[0]));
        this.pk_m_y = bn2uint8(BigInt(gpk[1]));
        this.pk_icc_x = bn2uint8(BigInt(gpk[2]));
        this.pk_icc_y = bn2uint8(BigInt(gpk[3]));
        const sector = await verifier.methods.get_sector().call();
        this.pk_sector_x = bn2uint8(BigInt(sector[0]));
        this.pk_sector_y = bn2uint8(BigInt(sector[1]));

        this._petitiontype = parseInt(await this.idpcontract.methods.petitiontype().call());

        console.log("Keys", "pk_m_x", this.pk_m_x, "pk_m_y", this.pk_m_y, "pk_icc_x", this.pk_icc_x, "pk_sector_x", this.pk_sector_x, "pk_sector_y", this.pk_sector_y, "gpk", gpk, "sector", sector);
    }

    async signPetition(petitionaddr: string, c: Uint8Array, s1: Uint8Array, s2: Uint8Array, i_sector_icc_1: Uint8Array) {
        const c_str = `0x${uint8tohex(c)}`;
        const s1_str = `0x${uint8tohex(s1)}`;
        const s2_str = `0x${uint8tohex(s2)}`;

        const i_sector_icc_1_parts = ecc_point_to_sol_struct(ecc_uncompressed_parts(i_sector_icc_1));
        console.log("PSS Sign", petitionaddr, "c", c, "c_str", c_str, "s1", s1, "s1_str", s1_str, "s2", s2, "s2_str", s2_str, "i_sector_icc_1", i_sector_icc_1, "i_sector_icc_1_parts", i_sector_icc_1_parts);
        const contract = this.petition(petitionaddr);
        const tx = await contract.methods.sign(
            c_str,
            s1_str,
            s2_str,
            i_sector_icc_1_parts
        ).send({ from: this.account });
        return tx;
    }

    async hasSigned(petitionaddr: string, i_sector_icc_1: Uint8Array): Promise<boolean> {
        const i_sector_icc_1_parts = ecc_point_to_sol_struct(ecc_uncompressed_parts(i_sector_icc_1));
        const contract = this.petition(petitionaddr);
        const web3result = await contract.methods.hasSigned(i_sector_icc_1_parts).call();
        console.log("PSS Has Signed?", petitionaddr, i_sector_icc_1, i_sector_icc_1_parts, web3result);
        return web3result;
    }

    petitiontype(): PetitionType {
        return this._petitiontype;
    }
    idp(addr: string): Contract {
        return new this.api.eth.Contract((PssIDPContract.abi as any), addr);
    }
    petition(addr: string): Contract {
        return new this.api.eth.Contract((PssPetitionContract.abi as any), addr);
    }
}

export class SemaphoreEthereumConnector extends EthereumConnector {
    _petitiontype: PetitionType

    constructor(provider: Web3, registry: Contract, account?: string, privkey?: string, chainid?: number) {
        super(provider, registry, account, privkey, chainid);
    }

    async interval(): Promise<number> {
        return 864000;
    }

    async init(): Promise<void> {
        await super.init();
        this._petitiontype = parseInt(await this.idpcontract.methods.petitiontype().call());
    }

    async signPetition(petitionaddr: string, merkleTreeDepth: number, merkleTreeRoot: string, nullifier: string, points: Array<string>) {
        if (points.length != 8) {
            throw new Error("Invalid proof size, must be 8 points");
        }
        const contract = this.petition(petitionaddr);
        return contract.methods.sign(merkleTreeDepth, merkleTreeRoot, nullifier, points).send({ from: this.account });
    }

    async hasSigned(petitionaddr: string): Promise<boolean> {
        // TODO this needs the nullifiers to be known, however they cannot be easily obtained from the Semaphore SC
        return false;
    }

    async addMember(identity: bigint) {
        this.idpcontract.methods.addMember(identity).call();
    }

    async addMembers(identities: Array<bigint>): Promise<void> {
        const param = identities.map((i) => i.toString());
        console.log("Call addMembers with", param);

        const method = await this.idpcontract.methods.addMembers(param)
        const data = method.encodeABI();
        const gas = await method.estimateGas({ from: this.account });
        const raw_tx = {
            from: this.account,
            to: await this.registrycontract.methods.idp().call(),
            data,
            gas
        };
        console.log("Transaction", raw_tx);
        const signed = await this.api.eth.accounts.signTransaction(raw_tx, this.privkey!);
        await this.api.eth.sendSignedTransaction(signed.rawTransaction!);
    }

    async merkleInfo(): Promise<ISemaphoreMerkleInfo> {
        return {
            root: await this.idpcontract.methods.getMerkleTreeRoot().call(),
            depth: await this.idpcontract.methods.getMerkleTreeDepth().call(),
            size: await this.idpcontract.methods.getMerkleTreeSize().call(),
        }
    }

    petitiontype(): PetitionType {
        return this._petitiontype;
    }
    idp(addr: string): Contract {
        return new this.api.eth.Contract((SemaphoreIDPContract.abi as any), addr);
    }
    petition(addr: string): Contract {
        return new this.api.eth.Contract((SemaphorePetitionContract.abi as any), addr);
    }


}

export enum PetitionType {
    Naive = 0,
    ZK = 1,
    PSSSecp256k1 = 2,
    PSSAltBn128 = 3,
    Semaphore = 4
}

function bn2uint8(x: bigint): Array<number> {
    const ary: number[] = [];
    while (x > 0) {
        ary.push(Number(x & 0xFFn));
        x = x >> 8n;
    }
    return ary.reverse();
}

function uint8tohex(x: Uint8Array): string {
    return Array.from(x).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function ecc_uncompressed_to_compressed(uncompressed: Uint8Array): { parity: number, x: Uint8Array } {
    if (uncompressed.length % 2 === 0 || uncompressed[0] !== 0x04) {
        throw new Error("Expected an uncompressed point");
    }
    // Parity
    // From BSI TR03111: More precisely, the bit y'P is defined to be the rightmost bit of yP , i.e. y'P = 0 if and only if yP is even
    // If y'P = 0, set C = 0x02
    // If y'P = 1, set C = 0x03
    const parity = (uncompressed[uncompressed.length - 1] & 1) + 2;
    const uncompressed_x_len = (uncompressed.length - 1) / 2;
    const uncompressed_x = uncompressed.slice(1, uncompressed_x_len + 1);
    return { parity, x: uncompressed_x };
}

function ecc_uncompressed_parts(uncompressed: Uint8Array): { X: Uint8Array, Y: Uint8Array } {
    if (uncompressed.length % 2 === 0 || uncompressed[0] !== 0x04) {
        throw new Error("Expected an uncompressed point");
    }
    const uncompressed_part_len = (uncompressed.length - 1) / 2;
    const uncompressed_x = uncompressed.slice(1, uncompressed_part_len + 1);
    const uncompressed_y = uncompressed.slice(uncompressed_part_len + 1, uncompressed.length);

    if (uncompressed_x.length != 32 || uncompressed_y.length != 32) {
        throw new Error("Unexpected point format");
    }

    return { X: uncompressed_x, Y: uncompressed_y };
}

function ecc_point_to_sol_struct(point: { X: Uint8Array, Y: Uint8Array }): { X: string, Y: string } {
    return {
        X: `0x${uint8tohex(point.X)}`,
        Y: `0x${uint8tohex(point.Y)}`
    };
}