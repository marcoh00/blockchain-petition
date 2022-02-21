import * as sqlite3 from "sqlite3";
import { IRegistration } from "./api";
import { DataHash, SHA256Hash } from '../../shared/merkle';
import { rejects } from "assert";
import { resolve } from "path/posix";

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

    async isRegistered(registration: IRegistration): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT pubkey, identity, period
                FROM idp_pubkeys
                WHERE (identity = ? AND period = ?)
                      OR pubkey = ?`,
                [registration.identity, registration.period, registration.pubkey],
                (err, row) => {
                    if(row === undefined) reject(err);
                    else resolve(true);
                });
        });
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
                in_block INTEGER,
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
                proof TEXT NOT NULL
            );

            INSERT INTO idp_meta (schema) VALUES (1);
        `);
    }

    async pubkeys_to_include(period: number): Promise<Array<string>> {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT p.pubkey, p.identity, p.period, t.hash, t.proof
                FROM idp_pubkeys p
                LEFT OUTER JOIN idp_pubkey_in_tree t
                ON p.pubkey = t.pubkey
                WHERE t.pubkey IS NULL AND p.period = ?
            `, [period], (err, rows) => {
                if(rows === undefined) reject(err);
                else resolve(rows.map((value => value["pubkey"])));
            });
        });
    }

    async insertTree(root: string, period: number) {
        return new Promise((resolve, reject) => {
            this.db.run(`
                INSERT INTO idp_tree_hashes (
                    hash, period
                ) VALUES (
                    ?, ?
                )
            `, [root, period], (res, err) => res === undefined ? reject(err) : resolve(res))
        });
    }

    async insertProof(root: string, pubkey: string, proof: string) {
        return new Promise((resolve, reject) => {
            this.db.run(`
                INSERT INTO idp_pubkey_in_tree (
                    hash, pubkey, proof
                ) VALUES (
                    ?, ?, ?
                )
            `, [root, pubkey, proof], (res, err) => res === undefined ? reject(err) : resolve(res))
        });
    }

    fake_identites(depth: number) {
        // yes.
    }
}