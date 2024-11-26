import express from "express";
import cors, { CorsOptions } from "cors";
import { randomBytes } from "crypto";
import { IRegistration, checkValidType, IProofRequest } from "../../shared/idp";
import { Database } from "./database";
import { NaiveEthereumConnector, ZKEthereumConnector, getWeb3Connector, EthereumConnector, PetitionType, PssEthereumConnector, SemaphoreEthereumConnector } from "../../shared/web3";
import { DEFAULT_NETWORK, DBFILE, PROVINGKEY, REGISTRY_CONTRACT_HARDHAT_ZK, REGISTRY_CONTRACT_HARDHAT } from '../../shared/addr';
import yargs from 'yargs';
import { IGroupManagerKey, IProofHandler, NaiveProofHandler, PssProofHandler, SemaphoreProofHandler, ZKProofHandler } from "./proof";
import { readFileSync } from "fs";

const app = express();
app.use(express.json());

const argv = yargs
    .option('registry', { string: true })
    .option('port', { number: true })
    .option('database', { string: true })
    .option('api', { string: true })
    .option('account', { string: true })
    .option('privkey', { string: true })
    .option('provingkey', { string: true })
    .option('psskey', { string: true })
    .argv;

const PORT: number = argv.port === undefined ? 65535 : parseInt(argv.port);
const REGISTRY_CONTRACT: string = argv.registry === undefined ? DEFAULT_NETWORK.registry_contract : argv.registry;
const DB_FILE = argv.database === undefined ? DBFILE : argv.database;
const DATABASE = new Database(DB_FILE);
const API = argv.api === undefined ? DEFAULT_NETWORK.wsapi : argv.api;
const ACCOUNT = argv.account === undefined ? DEFAULT_NETWORK.account : argv.api;
const PRIVKEY = argv.privkey === undefined ? DEFAULT_NETWORK.privkey : argv.privkey;
const PROVINGKEY_FILE = argv.provingkey === undefined ? PROVINGKEY : argv.provingkey;
const PSSKEY_FILE = argv.psskey === undefined ? "psskey.json" : argv.psskey;

let ethereum: EthereumConnector = null;
let proof_handler: IProofHandler = null;

async function determine_listen_port(fallback: number): Promise<number> {
    if (typeof (argv.port) === "number") return argv.port;
    try {
        if (typeof (argv.port) === "string" && argv.port.length > 0) return Number.parseInt(argv.port);
        const idpPort: string = await ethereum.idpcontract.methods.url().call();
        const parts = idpPort.split(":");
        if (parts.length === 3) return Number.parseInt(parts[2]);
    } catch (e) {
        // pass
    }
    return fallback;
}

const corsOptions: CorsOptions = {
    methods: ["GET", "POST"],
    origin: ["http://localhost:8080", `http://localhost:${PORT}`]
}

app.use("/proving.key", cors(corsOptions), express.static(PROVINGKEY_FILE));

app.get('/', (req, res) => {
    res.json({ 'timestamp': Math.floor(Date.now() / 1000) });
})

app.get('/web3', async (req, res) => {
    let web3info = {
        "account": (await ethereum.api.eth.getAccounts())[0],
        "balance": await ethereum.api.eth.getBalance((await ethereum.api.eth.getAccounts())[0]),
        "idp": {
            "period": await ethereum.idpcontract.methods.period().call(),
            "periodlen": await ethereum.idpcontract.methods.periodlen().call(),
            "startperiod": await ethereum.idpcontract.methods.start_period(await ethereum.idpcontract.methods.period().call()).call(),
            "endperiod": await ethereum.idpcontract.methods.end_period(await ethereum.idpcontract.methods.period().call()).call()
        }
    };
    await proof_handler.update_web3_info(web3info);
    res.json(web3info);
})

app.options('/proof', cors(corsOptions));
app.post('/proof', cors(corsOptions), async (req, res) => {
    const proof_request = req.body as IProofRequest;
    if (!checkValidType(["token"], proof_request)) {
        res.statusCode = 400;
        res.json({ "error": "Malformed Request" });
        return;
    }
    proof_request.token = proof_request.token.toString();
    if (proof_request.token.length !== 64) {
        res.statusCode = 400;
        res.json({ "error": "Malformed Request" });
        return;
    }

    let database_result = null;
    try {
        database_result = await DATABASE.getProofInfo(proof_request.token);
    } catch (e) {
        res.statusCode = 500;
        res.json({ "error": "Internal Server Error" });
        return;
    }
    console.log("Proof request, db", database_result);
    if (database_result === null || typeof (database_result.token) !== "string") {
        res.statusCode = 404;
        res.json({ "error": "Unknown Token" });
        return;
    }
    if (typeof (database_result.hash) !== "string" || typeof (database_result.period) !== "number" || typeof (database_result.proof) !== "string") {
        res.statusCode = 503;
        res.json({ "error": "Proof has not been created yet" });
        return;
    }
    if (typeof (database_result.iteration) !== "number") {
        res.statusCode = 503;
        res.json({ "error": "Proof has not been added to the blockchain yet" });
        return;
    }
    const result = {
        hash: database_result.hash,
        iteration: database_result.iteration,
        period: database_result.period,
        proof: await proof_handler.return_proof(database_result.proof)
    };

    res.statusCode = 200;
    res.json(result);
    console.log("/proof return", result);
})

app.options('/register', cors(corsOptions));
app.post('/register', cors(corsOptions), async (req, res) => {
    const registration = req.body as IRegistration;
    const minperiod = await ethereum.period();
    const maxperiod = minperiod + 2;
    if (registration.period === -1) {
        console.log("register endpoint: request for current period");
        registration.period = minperiod;
    }
    let check = await proof_handler.check_registration_info(registration, minperiod, maxperiod);
    if (!check.success) {
        res.statusCode = check.status;
        res.json(check.ret);
        return;
    }
    const token = randomBytes(32).toString("hex");
    const register = await proof_handler.register(registration, token);
    res.statusCode = register.status;
    res.json(register.ret);
})

async function repeat() {
    console.log(`🌐 Try to create a new tree hash (period ${await ethereum.period()}, ${await ethereum.nextPeriod() - Math.floor((new Date()).valueOf() / 1000)}/${await ethereum.periodlen()})`);
    await proof_handler.interval_task();
}

setTimeout(async () => {
    ethereum = await getWeb3Connector(API, REGISTRY_CONTRACT, ACCOUNT, PRIVKEY);
    const petitiontype = ethereum.petitiontype();
    switch (petitiontype) {
        case PetitionType.Naive: {
            console.log("ℹ️  Naive Mode");
            proof_handler = new NaiveProofHandler(ethereum as NaiveEthereumConnector, DATABASE);
            break;
        }
        case PetitionType.ZK: {
            console.log("ℹ️  Zero-Knowledge Mode");
            proof_handler = new ZKProofHandler(ethereum as ZKEthereumConnector, DATABASE);
            break;
        }
        case PetitionType.PSSSecp256k1: {
            const key = JSON.parse(readFileSync(PSSKEY_FILE).toString()) as IGroupManagerKey;
            console.log("ℹ️  PSS Key Algorithm ", key.algorithm);
            proof_handler = new PssProofHandler(ethereum as PssEthereumConnector, DATABASE, key);
            break;
        }
        case PetitionType.PSSAltBn128: {
            const key = JSON.parse(readFileSync(PSSKEY_FILE).toString()) as IGroupManagerKey;
            console.log("ℹ️  PSS Key Algorithm ", key.algorithm);
            proof_handler = new PssProofHandler(ethereum as PssEthereumConnector, DATABASE, key);
            break;
        }
        case PetitionType.Semaphore: {
            console.log("ℹ️  Semaphore Mode");
            proof_handler = new SemaphoreProofHandler(ethereum as SemaphoreEthereumConnector, DATABASE);
            break;
        }
        default: throw Error("Cannot serve unknown petition type");
    }

    let p = await determine_listen_port(11024);

    app.listen(p, async () => {


        console.log(`👂 IDP listening on ${p}`);
        console.log(`ℹ️  Using Ethereum API ${API}`);
        console.log(`ℹ️  Using Registry Smart Contract at ${REGISTRY_CONTRACT}`);
        console.log(`ℹ️  IDP Type is ${ethereum.petitiontype()}`);
        console.log(`ℹ️  Using Account ${ACCOUNT}`);
        console.log(`ℹ️  Using Private Key 0x${PRIVKEY.charAt(2)}${PRIVKEY.charAt(3)}...`);
        console.log(`💾 Connecting to database at ${DB_FILE}`);
        const interval = await proof_handler.interval();
        console.log(`🌐 Try to create a new tree hash every ${interval}s`);
        setInterval(repeat, interval * 1000);

    })
}, 1);
