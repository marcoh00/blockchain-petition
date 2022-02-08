import * as express from "express";
import { Database } from "./database";

const port = 65535;
const account = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';
const privkey = '0xea6c44ac03bff858b476bba40716402b03e41b8e97e276d1baec7c37d42484a0';
const api = 'http://localhost:8545';
const contract = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const databasefile = `dist/database.db`;

const app = express();
const database = new Database(databasefile);

app.get('/', (req, res) => {
    res.json({'timestamp': Math.floor(Date.now() / 1000)});
})

app.listen(port, () => {
    console.log(`👂 IDP listening on ${port}`);
    console.log(`ℹ️ Using Ethereum API ${api}`);
    console.log(`ℹ️ Using IDP Smart Contract at ${contract}`);
    console.log(`ℹ️ Using Account ${account}`);
    console.log(`ℹ️ Using Private Key 0x${privkey.charAt(2)}${privkey.charAt(3)}...`);
    console.log(`💾 Connecting to database at ${databasefile}`);
    database.connect();
})