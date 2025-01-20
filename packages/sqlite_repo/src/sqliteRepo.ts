import sqlite3 from 'sqlite3';
import { v4 as uuid } from 'uuid';
import { Envelope, Id, Repository } from "@meshql/common";
import {Database} from "sqlite";

export class SQLiteRepository implements Repository<string> {
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
                id TEXT UNIQUE,
                payload TEXT NOT NULL,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                deleted INTEGER DEFAULT 0,
                authorized_tokens JSON
            );
        `);
    }

    create = async (doc: Envelope<string>, tokens: string[] = []): Promise<Envelope<string>> => {
        const query = `
            INSERT INTO ${this.table} (id, payload, authorized_tokens)
            VALUES (?, ?, ?);
        `;
        const id = doc.id || uuid();
        const values = [id, JSON.stringify(doc.payload), JSON.stringify(tokens || [])];

        await this.db.run(query, values );
        return { ...doc, id, deleted: false, created_at: new Date() };
    };

    createMany = async (payloads: Envelope<string>[]): Promise<Envelope<string>[]> => {
        const now = Date.now();

        let created: Envelope<string>[] = [];
        await this.db.run("BEGIN TRANSACTION");
        for (const envelope of payloads) {
            created.push(await this.create({ ...envelope, created_at: new Date(now) }));
        }
        await this.db.run("COMMIT");

        return created;
    };

    read = async (id: Id<string>, tokens: string[] = []): Promise<Envelope<string>> => {
        const query = `
            SELECT * FROM ${this.table}
            WHERE id = ? AND deleted = 0
            ${tokens.length > 0 ? `AND EXISTS (SELECT 1 FROM json_each(authorized_tokens) WHERE value IN (SELECT value FROM json_each(?)))` : ""}
            ORDER BY created_at DESC
            LIMIT 1;
        `;
        const values = tokens.length > 0 ? [id, JSON.stringify(tokens)] : [id];

        const row: any = await this.db.get(query, values);

        if (!row) return row;

        return {
            id: row.id,
            payload: JSON.parse(row.payload),
            created_at: new Date(row.created_at),
            deleted: !!row.deleted
        };
    };

    readMany = async (ids: Id<string>[], tokens: string[] = []): Promise<Envelope<string>[]> => {
        const query = `
            SELECT * FROM ${this.table}
            WHERE id IN (${ids.map(() => "?").join(", ")}) AND deleted = 0
            ${tokens.length > 0 ? `AND EXISTS (SELECT 1 FROM json_each(authorized_tokens) WHERE value IN (SELECT value FROM json_each(?)))` : ""}
            ORDER BY created_at DESC;
        `;
        const values = [...ids, ...(tokens.length > 0 ? [JSON.stringify(tokens)] : [])];

        const rows = await this.db.all(query, values);

        return rows.map(row => ({
            id: row.id,
            payload: JSON.parse(row.payload),
            created_at: new Date(row.created_at),
            deleted: !!row.deleted
        }))
    };

    remove = async (id: Id<string>, tokens: string[] = []): Promise<boolean> => {
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

    removeMany = async (ids: Id<string>[]): Promise<Record<Id<string>, boolean>> => {
        const result: Record<Id<string>, boolean> = {};

        await this.db.run("BEGIN TRANSACTION");
        for (const id of ids) {
            result[id] = await this.remove(id);
        }
        await this.db.run("COMMIT");

        return result;
    }

    list = async (tokens: string[] = []): Promise<Envelope<string>[]> => {
        const query = `
            SELECT * FROM ${this.table}
            WHERE deleted = 0
            ${tokens.length > 0 ? `AND EXISTS (SELECT 1 FROM json_each(authorized_tokens) WHERE value IN (SELECT value FROM json_each(?)))` : ""}
            ORDER BY created_at DESC;
        `;
        const values:string[] = tokens.length > 0 ? [JSON.stringify(tokens)] : [];

        const rows = await this.db.all(query, values);

        return rows.map(row => ({
            id: row.id,
            payload: JSON.parse(row.payload),
            created_at: new Date(row.created_at),
            deleted: !!row.deleted
        }));
    };
}
