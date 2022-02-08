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
}