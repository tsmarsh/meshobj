import sqlite3 from 'sqlite3';
import { v4 as uuid } from 'uuid';
import { Envelope, Id, Repository } from "@meshql/common";
import {Database} from "sqlite";

/** 
 * In SQLite, we can store creation timestamps in milliseconds since epoch by using
 * the "julianday()" function. The expression:
 *
 *   CAST((julianday('now') - 2440587.5)*86400000 AS INTEGER)
 *
 * calculates the milliseconds since Unix epoch. Explanation:
 * - julianday('now') gives current time in days since noon in Greenwich on November 24, 4714 B.C.
 * - 2440587.5 is the Julian day number for Unix epoch start (1970-01-01T00:00:00Z).
 * - Multiply (days) by 86400000 → milliseconds in a day.
 * - CAST(... AS INTEGER) to store in an integer column.
 */

export class SQLiteRepository implements Repository {
    private db: Database;
    private table: string;

    constructor(db: Database, table: string) {
        this.db = db;
        this.table = table;
    }

    async initialize(): Promise<void> {
        await this.db.exec( `
            CREATE TABLE IF NOT EXISTS ${this.table} (
                _id INTEGER PRIMARY KEY,
                id TEXT,
                payload JSON NOT NULL,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                deleted INTEGER DEFAULT 0,
                authorized_tokens JSON,
                UNIQUE (id, created_at)
            );
        `);
    }

    private rowToEnvelope = (row: any): Envelope => {
        return {
            id: row.id,
            payload: JSON.parse(row.payload),
            created_at: new Date(row.created_at),
            deleted: !!row.deleted,
            authorized_tokens: JSON.parse(row.authorized_tokens ?? "[]"),
        };
    }

    create = async (doc: Envelope, tokens: string[] = []): Promise<Envelope> => {
        const query = `
            INSERT INTO ${this.table} (id, payload, created_at, authorized_tokens)
            VALUES (?, ?, ?, ?);
        `;
        const id = doc.id || uuid();
        const createdAt = Date.now();
        const values = [id, JSON.stringify(doc.payload), createdAt, JSON.stringify(tokens || [])];

        try {
            const { lastID } = await this.db.run(query, values);
            
            const row = await this.db.get(
                `SELECT * FROM ${this.table} WHERE rowid = ?`,
                [lastID]
            );

            return this.rowToEnvelope(row);
        } catch (err: any) {
            if (err.code === "SQLITE_CONSTRAINT") {
                await new Promise((resolve) => setTimeout(resolve, 2));
                return this.create(doc, tokens);
            }
            throw err;
        }
    };

    createMany = async (payloads: Envelope[], tokens: string[] = []): Promise<Envelope[]> => {
        const created: Envelope[] = [];
        await this.db.run("BEGIN TRANSACTION");
        for (const envelope of payloads) {
            created.push(await this.create(envelope, tokens));
        }
        await this.db.run("COMMIT");
        return created;
    };

    read = async (id: Id, tokens: string[] = [], at: Date = new Date()): Promise<Envelope | undefined> => {
        const atMs = at.getTime();

        const query = `
            SELECT * FROM ${this.table}
            WHERE id = ? AND deleted = 0 AND created_at <= ?
            ${tokens.length > 0 ? `AND EXISTS (SELECT 1 FROM json_each(authorized_tokens) WHERE value IN (SELECT value FROM json_each(?)))` : ""}
            ORDER BY created_at DESC
            LIMIT 1;
        `;
        const values = tokens.length > 0 ? [id, atMs, JSON.stringify(tokens)] : [id, atMs];

        const row: any = await this.db.get(query, values);

        if (!row) return undefined;

        return this.rowToEnvelope(row);
    };

    readMany = async (ids: Id[], tokens: string[] = []): Promise<Envelope[]> => {
        const now = Date.now();

        const query = `
            SELECT * FROM ${this.table}
            WHERE id IN (${ids.map(() => "?").join(", ")}) 
            AND deleted = 0
            AND created_at <= ?
            ${tokens.length > 0 ? `AND EXISTS (SELECT 1 FROM json_each(authorized_tokens) WHERE value IN (SELECT value FROM json_each(?)))` : ""}
            ORDER BY created_at DESC;
        `;
        const values = [...ids, now, ...(tokens.length > 0 ? [JSON.stringify(tokens)] : [])];

        const rows = await this.db.all(query, values);

        const seen = new Set<Id>();
        const envelopes: Envelope[] = [];

        for (const row of rows) {
            if (!seen.has(row.id)) {
                seen.add(row.id);
                envelopes.push(this.rowToEnvelope(row));
            }
        }

        return envelopes;
    };

    remove = async (id: Id, tokens: string[] = []): Promise<boolean> => {
        const query = `
            UPDATE ${this.table}
            SET deleted = 1
            WHERE id = ?
            ${tokens.length > 0 ? `AND EXISTS (SELECT 1 FROM json_each(authorized_tokens) WHERE value IN (SELECT value FROM json_each(?)))` : ""};
        `;
        const values = tokens.length > 0 ? [id, JSON.stringify(tokens)] : [id];

        const result = await this.db.run(query, values);
        return result.changes! > 0;
    };

    removeMany = async (ids: Id[]): Promise<Record<Id, boolean>> => {
        const result: Record<Id, boolean> = {};

        await this.db.run("BEGIN TRANSACTION");
        for (const id of ids) {
            result[id] = await this.remove(id);
        }
        await this.db.run("COMMIT");

        return result;
    }

    list = async (tokens: string[] = []): Promise<Envelope[]> => {
        const query = `
            SELECT * FROM ${this.table}
            WHERE deleted = 0
            ${tokens.length > 0 ? `AND EXISTS (SELECT 1 FROM json_each(authorized_tokens) WHERE value IN (SELECT value FROM json_each(?)))` : ""}
            ORDER BY created_at DESC;
        `;
        const values:string[] = tokens.length > 0 ? [JSON.stringify(tokens)] : [];

        const rows = await this.db.all(query, values);

        const seen = new Set<string>();
        const envelopes: Envelope[] = [];
        for (const row of rows) {
            if (!seen.has(row.id)) {
                seen.add(row.id);
                envelopes.push(this.rowToEnvelope(row));
            }
        }
        return envelopes;
    };
}
