import * as sqlite3 from "sqlite3";
import { IRegistration } from "./api";

export class Database {
    filename: string;
    db: sqlite3.Database;

    constructor(filename: string) {
        this.filename = filename;
        this.db = new sqlite3.Database(this.filename);
        this.maybe_init();
    }

    maybe_init() {
        this.db.get("SELECT schema FROM idp_meta", (err, row) => { if(row === undefined || Number.parseInt(row.schema) < 1) this.init() });
    }

    isRegistered(registration: IRegistration): boolean {
        let row_found = false;
        this.db.get("SELECT pubkey, identity, period FROM idp_pubkeys WHERE (identity = ? AND period = ?) OR pubkey = ?", [registration.identity, registration.period, registration.pubkey], (err, row) => { if(row === undefined) row_found = false; else row_found = true });
        return row_found;
    }

    register(registration: IRegistration) {
        this.db.run("INSERT INTO idp_pubkeys (pubkey, identity, period) VALUES (?, ?, ?)", [registration.pubkey, registration.identity, registration.period]);
    }

    init() {
        this.db.exec(`
            CREATE TABLE idp_meta (
                schema INTEGER UNIQUE NOT NULL
            );

            CREATE TABLE idp_tree_hashes (
                hash TEXT UNIQUE NOT NULL PRIMARY KEY,
                in_block INTEGER NOT NULL,
                period INTEGER NOT NULL
            );

            CREATE TABLE idp_pubkeys (
                pubkey TEXT UNIQUE NOT NULL PRIMARY KEY,
                identity TEXT NOT NULL,
                period INTEGER NOT NULL
            );

            CREATE TABLE idp_pubkey_in_tree (
                hash TEXT UNIQUE NOT NULL REFERENCES idp_tree_hashes(hash),
                pubkey TEXT UNIQUE NOT NULL REFERENCES idp_pubkeys(pubkey),
                proof BLOB NOT NULL
            );

            CREATE TABLE idp_pubkey_queue (
                pubkey TEXT UNIQUE NOT NULL REFERENCES idp_pubkeys(pubkey)
            );

            INSERT INTO idp_meta (schema) VALUES (1);
        `);
    }

    fake_identites(depth: number) {
        // yes.
    }
}