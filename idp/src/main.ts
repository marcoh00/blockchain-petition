import express from "express";
import cors, { CorsOptions } from "cors";
import { randomBytes } from "crypto";
import { checkRegistration, checkValidType, IRegistration, IProofRequest } from "./api";
import { Database } from "./database";
import { EthereumConnector } from "../../shared/web3";
import { SHA256Hash, MerkleTree } from '../../shared/merkle';
import { NETWORKS, DEFAULT_NETWORK, PORT, DBFILE, PROVINGKEY, BLOCKTECH_TYPE, BLOCKTECH_TYPES } from '../../shared/addr';
import { intervalTask } from "./task";

const app = express();
app.use(express.json());

const database = new Database(DBFILE);
const API = DEFAULT_NETWORK.wsapi;
const REGISTRY_CONTRACT = DEFAULT_NETWORK.registry_contract;
const ACCOUNT = DEFAULT_NETWORK.account;
const PRIVKEY = DEFAULT_NETWORK.privkey;
const ethereum = new EthereumConnector(API, REGISTRY_CONTRACT, ACCOUNT, PRIVKEY);

const corsOptions: CorsOptions = {
    methods: ["GET", "POST"],
    origin: ["http://localhost:8080", "http://localhost:65535"]
}

app.use("/proving.key", cors(corsOptions), express.static(PROVINGKEY));

app.get('/', (req, res) => {
    res.json({'timestamp': Math.floor(Date.now() / 1000)});
})

app.get('/web3', async (req, res) => {
    res.json({
        "account": (await ethereum.api.eth.getAccounts())[0],
        "balance": await ethereum.api.eth.getBalance((await ethereum.api.eth.getAccounts())[0]),
        "idp": {
            "depth": await ethereum.idpcontract.methods.depth().call(),
            "period": await ethereum.idpcontract.methods.period().call(),
            "periodlen": await ethereum.idpcontract.methods.periodlen().call(),
            "startperiod": await ethereum.idpcontract.methods.start_period(await ethereum.idpcontract.methods.period().call()).call(),
            "endperiod": await ethereum.idpcontract.methods.end_period(await ethereum.idpcontract.methods.period().call()).call()
        }
    });
})

app.options('/proof', cors(corsOptions));
app.post('/proof', cors(corsOptions), async (req, res) => {
    const proof_request = req.body as IProofRequest;
    if(!checkValidType(["token"], proof_request)) {
        res.statusCode = 400;
        res.json({ "error": "Malformed Request" });
        return;
    }
    proof_request.token = proof_request.token.toString();
    if(proof_request.token.length !== 64) {
        res.statusCode = 400;
        res.json({ "error": "Malformed Request" });
        return;
    }

    let found = false;
    let database_result = null;
    try {
        database_result = await database.getProofInfo(proof_request.token);
    } catch(e) {
        res.statusCode = 500;
        res.json({ "error": "Internal Server Error" });
        return;
    }
    console.log("Proof request, db", database_result);
    if(database_result === null || typeof(database_result.token) !== "string") {
        res.statusCode = 404;
        res.json({ "error": "Unknown Token" });
        return;
    }
    if(typeof(database_result.hash) !== "string" || typeof(database_result.period) !== "number" || typeof(database_result.proof) !== "string") {
        res.statusCode = 503;
        res.json({ "error": "Proof has not been created yet" });
        return;
    }
    if(typeof(database_result.iteration) !== "number") {
        res.statusCode = 503;
        res.json({ "error": "Proof has not been added to the blockchain yet" });
        return;
    }
    const result = {
        hash: database_result.hash,
        iteration: database_result.iteration,
        period: database_result.period,
        proof: JSON.parse(database_result.proof)
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
    if(!checkValidType(["identity", "client_identity", "period"], registration)) {
        res.statusCode = 400;
        res.json({ "error": "Malformed Request" });
        return;
    }
    if(registration.period === -1) {
        console.log("register endpoint: request for current period");
        registration.period = minperiod;
    }
    if(!checkRegistration(registration, minperiod, maxperiod)) {
        res.statusCode = 400;
        res.json({ "error": "Invalid registration" });
        return;
    }
    try {
        const token = randomBytes(32).toString("hex");
        if (BLOCKTECH_TYPE === BLOCKTECH_TYPES.mit_zk) {
            if(await database.isRegistered(registration)) {
                res.statusCode = 405;
                res.json({ "error": "Public Key is already registered for given period" });
                return;
            }
            const result = await database.register(registration, token);
            console.log(`💾 Registration saved to database`, registration, token, result);
        } else {
            // Ohne zk
            console.log("TRY TO SUBMIT ACCOUNT")
            await ethereum.submitHash(registration.client_identity,registration.period);
            console.log(`💾 Registration done`, registration, token);
        }
        res.statusCode = 200;
        res.json({ "token": token });
        return;
    } catch(e) {
        res.statusCode = 500;
        res.json({ "error": e });
        return;
    }
})

async function repeat() {
    console.log(`🌐 Try to create a new tree hash (period ${await ethereum.period()}, ${await ethereum.nextPeriod() - Math.floor((new Date()).valueOf() / 1000)}/${await ethereum.periodlen()})`);
    await intervalTask(ethereum, database);
}

async function hashAddedEvent(err, event, subscription) {
    console.log("HashAdded Event", err, event, subscription);
    const hash_result = event.returnValues[0] as string
    const hash = hash_result.startsWith("0x") ? hash_result.substring(2) : hash_result;
    const period = event.returnValues[1];
    const iteration = event.returnValues[2];
    console.log("Values are", hash, period, iteration, typeof hash, typeof period, typeof iteration);
    await database.updateTreeWithIteration(hash, iteration);
}

app.listen(PORT, async () => {
    await ethereum.init();
    // Das HashAdded Event ist nur wichtig fuer die mit zk Version
    // Aber nur mit zk smart Contract emitieren dieses Event 
    ethereum.idpcontract.events.HashAdded({
        fromBlock: "latest"
    }, hashAddedEvent);
    console.log(`👂 IDP listening on ${PORT}`);
    console.log(`ℹ️  Using Ethereum API ${API}`);
    console.log(`ℹ️  Using Registry Smart Contract at ${REGISTRY_CONTRACT}`);
    console.log(`ℹ️  Using Account ${ACCOUNT}`);
    console.log(`ℹ️  Using Private Key 0x${PRIVKEY.charAt(2)}${PRIVKEY.charAt(3)}...`);
    console.log(`💾 Connecting to database at ${DBFILE}`);
    const interval = Math.ceil(await ethereum.interval());
    console.log(`🌐 Try to create a new tree hash every ${interval}s`);
    if (BLOCKTECH_TYPE === BLOCKTECH_TYPES.mit_zk) {
        setInterval(repeat, interval * 1000);
    } // else ohne zk
    
})