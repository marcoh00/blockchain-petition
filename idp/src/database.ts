import * as sqlite3 from "sqlite3";
import { IRegistration } from "../../shared/idp";

export class Database {
    filename: string;
    db: sqlite3.Database;

    constructor(filename: string) {
        this.filename = filename;
        this.db = new sqlite3.Database(this.filename);
        this.maybe_init();
    }

    maybe_init() {
        this.db.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='idp_meta'",
            (error, row: {name: string}) => {
              if (error) {
                console.error(error.message);
              } else if (row) {
                this.db.get("SELECT schema FROM idp_meta", (err, row: {schema: string}) => { 
                    if(row === undefined || Number.parseInt(row.schema) < 1) {
                        // DB wurde noch nicht richtig initialisiert
                        this.init();
                    } 
                });
              } else {
                // DB wurde noch nicht initialisiert
                this.init();
              }
            }
          );
        //;
    }

    async isRegistered(registration: IRegistration): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT pubkey, identity, period
                FROM idp_pubkeys
                WHERE (identity = ? OR pubkey = ?) AND period = ?`,
                [registration.identity, registration.client_identity, registration.period],
                (err, row) => {
                    if(row === undefined) resolve(false);
                    else {
                        console.log("isRegistered, dbRow:", row);
                        resolve(true);
                    }
                });
        });
    }

    async getProofInfo(token: string): Promise<any> {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT p.token, t.hash, t.iteration, t.period, pt.proof
                FROM idp_pubkeys p
                LEFT JOIN idp_pubkey_in_tree pt
                ON p.pubkey = pt.pubkey
                LEFT JOIN idp_tree_hashes t
                ON pt.hash = t.hash
                WHERE p.token = ?
            `, [token], (err, row) => row === undefined ? reject(err) : resolve(row))
        });
    }

    async register(registration: IRegistration, token: string) {
        return new Promise((resolve, reject) => {
            this.db.run(`
                INSERT INTO idp_pubkeys
                (pubkey, identity, period, token)
                VALUES
                (?, ?, ?, ?)
            `, [registration.client_identity, registration.identity, registration.period, token], (res, err) => res === undefined ? reject(err) : resolve(res));
        });
    }

    init() {
        this.db.exec(`
            CREATE TABLE idp_meta (
                schema INTEGER UNIQUE NOT NULL
            );

            CREATE TABLE idp_tree_hashes (
                hash TEXT UNIQUE NOT NULL PRIMARY KEY,
                iteration INTEGER,
                period INTEGER NOT NULL
            );

            CREATE TABLE idp_pubkeys (
                pubkey TEXT NOT NULL PRIMARY KEY,
                identity TEXT NOT NULL,
                period INTEGER NOT NULL,
                token TEXT UNIQUE NOT NULL
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

    async treesToIncludeOnBlockchain(period: number): Promise<Array<string>> {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT hash
                FROM idp_tree_hashes
                WHERE period = ?
                    AND iteration IS NULL
            `, [period], (err, rows) => {
                if(rows === undefined) reject(err);
                else resolve(rows.map(value => value["hash"]));
            })
        });
    }

    async updateTreeWithIteration(hash: string, iteration: number): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run(`
                UPDATE idp_tree_hashes
                SET iteration = ?
                WHERE hash = ?
            `, [iteration, hash], (res, err) => res === undefined ? reject(err) : resolve(res));
        });
    }

    fake_identites(depth: number) {
        // yes.
    }
}