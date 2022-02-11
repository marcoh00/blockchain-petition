import express from "express";
import { checkRegistration, checkValidType, IRegistration } from "./api";
import { Database } from "./database";
import { EthereumConnector } from "./web3";

const port = 65535;
const account = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';
const privkey = '0xea6c44ac03bff858b476bba40716402b03e41b8e97e276d1baec7c37d42484a0';
const api = 'ws://127.0.0.1:8545';
const contract = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const databasefile = `dist/database.db`;

const app = express();
app.use(express.json());

const database = new Database(databasefile);
const ethereum = new EthereumConnector(api, contract, account, privkey);

app.get('/', (req, res) => {
    res.json({'timestamp': Math.floor(Date.now() / 1000)});
})

app.get('/web3', async (req, res) => {
    res.json({
        "account": (await ethereum.api.eth.getAccounts())[0],
        "balance": await ethereum.api.eth.getBalance((await ethereum.api.eth.getAccounts())[0]),
        "idp": {
            "depth": await ethereum.contract.methods.depth().call(),
            "period": await ethereum.contract.methods.period().call(),
            "periodlen": await ethereum.contract.methods.periodlen().call(),
            "startperiod": await ethereum.contract.methods.start_period(await ethereum.contract.methods.period().call()).call(),
            "endperiod": await ethereum.contract.methods.end_period(await ethereum.contract.methods.period().call()).call()
        }
    });
})

app.post('/register', async (req, res) => {
    const registration = req.body as IRegistration;
    const minperiod = await ethereum.period();
    const maxperiod = minperiod + 2;
    if(!checkValidType(["identity", "pubkey", "period"], registration)) {
        res.statusCode = 400;
        res.json({ "error": "Malformed Request" });
        return;
    }
    if(registration.period === -1) {
        registration.period = await ethereum.period();
    }
    if(!checkRegistration(registration, minperiod, maxperiod)) {
        res.statusCode = 400;
        res.json({ "error": "Invalid registration" });
        return;
    }
    try {
        if(database.isRegistered(registration)) {
            res.statusCode = 405;
            res.json({ "error": "Public Key is already registered for given period" });
            return;
        }
        database.register(registration);
        res.statusCode = 200;
        console.log(`💾 Registration saved to database`, registration);
        return;
    } catch(e) {
        res.statusCode = 500;
        res.json({ "error": e });
        return;
    }
})

async function repeat() {
    const thisPeriod = await ethereum.period();
    console.log(`🌐 Tree ${await ethereum.lastIteration()} in period ${thisPeriod} (next period in ${Math.ceil(await ethereum.nextPeriod() - (Date.now() / 1000))}s)`);
}

app.listen(port, async () => {
    console.log(`👂 IDP listening on ${port}`);
    console.log(`ℹ️  Using Ethereum API ${api}`);
    console.log(`ℹ️  Using IDP Smart Contract at ${contract}`);
    console.log(`ℹ️  Using Account ${account}`);
    console.log(`ℹ️  Using Private Key 0x${privkey.charAt(2)}${privkey.charAt(3)}...`);
    console.log(`💾 Connecting to database at ${databasefile}`);
    const interval = Math.ceil(await ethereum.interval());
    console.log(`🌐 Try to create a new tree hash every ${interval}s`);
    setInterval(repeat, interval * 1000);
})