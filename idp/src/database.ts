import * as sqlite3 from "sqlite3";

export class Database {
    filename: string;
    db: sqlite3.Database;

    constructor(filename: string) {
        this.filename = filename;
    }

    connect() {
        this.db = new sqlite3.Database(this.filename);
        this.maybe_init();
    }

    maybe_init() {
        this.db.get("SELECT schema FROM idp_meta", (err, row) => { if(row === undefined || Number.parseInt(row.schema) < 1) this.init() });
    }

    init() {
        this.db.exec(`
            CREATE TABLE idp_meta (
                schema INTEGER UNIQUE NOT NULL
            );

            CREATE TABLE idp_identities (
                identity TEXT UNIQUE NOT NULL PRIMARY KEY,
                last_verification INTEGER NOT NULL
            );

            CREATE TABLE idp_tree_hashes (
                hash TEXT UNIQUE NOT NULL PRIMARY KEY,
                in_block INTEGER
            );

            CREATE TABLE idp_pubkeys (
                pubkey TEXT UNIQUE NOT NULL PRIMARY KEY,
                identity TEXT NOT NULL REFERENCES idp_identities(identity)
            );

            CREATE TABLE idp_pubkey_in_tree (
                hash TEXT UNIQUE NOT NULL REFERENCES idp_tree_hashes(hash),
                pubkey TEXT UNIQUE NOT NULL REFERENCES idp_pubkeys(pubkey),
                proof BLOB NOT NULL
            );

            INSERT INTO idp_meta (schema) VALUES (1);
        `)
    }
}