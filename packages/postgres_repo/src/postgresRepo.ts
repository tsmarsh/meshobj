import { Pool, types } from "pg";
import { v4 as uuid } from "uuid";
import { Envelope, Id, Repository } from "@meshql/common";

export class PostgresRepository implements Repository {
    private pool: Pool;
    private table: string;

    constructor(pool: Pool, table: string) {
        this.pool = pool;
        this.table = table;
    }

    async initialize(): Promise<void> {
        const TIMESTAMP_OID = 1114; // TIMESTAMP without time zone
        const TIMESTAMPTZ_OID = 1184; // TIMESTAMP with time zone

        // Override the default parsers for timestamps
        types.setTypeParser(TIMESTAMP_OID, (value: string) => new Date(value));
        types.setTypeParser(TIMESTAMPTZ_OID, (value: string) => new Date(value));

        const query = `
            CREATE TABLE IF NOT EXISTS ${this.table} (
                id TEXT PRIMARY KEY,
                payload JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
                deleted BOOLEAN DEFAULT FALSE,
                readers TEXT[]
            );
        `;
        await this.pool.query(query);

        await this.pool.query(`
            CREATE INDEX IF NOT EXISTS idx_${this.table}_created_at
            ON ${this.table} (created_at);
        `);

        await this.pool.query(`
            CREATE INDEX IF NOT EXISTS idx_${this.table}_deleted
            ON ${this.table} (deleted);
        `);

        await this.pool.query(`
            CREATE INDEX IF NOT EXISTS idx_${this.table}_readers
            ON ${this.table} USING GIN (readers);
        `);
    }

    create = async (doc: Envelope, readers: string[] = []): Promise<Envelope> => {
        const query = `
            INSERT INTO ${this.table} (id, payload, created_at, updated_at, deleted, readers)
            VALUES ($1, $2::jsonb, NOW(), NOW(), FALSE, $3)
            RETURNING *;
        `;
        const id = doc.id || uuid();
        const values = [id, doc.payload, readers];

        const result = await this.pool.query(query, values);

        let row = result.rows[0];
        return row;
    };

    createMany = async (docs: Envelope[], readers: string[] = []): Promise<Envelope[]> => {
        const query = `
            INSERT INTO ${this.table} (id, payload, created_at, updated_at, deleted, readers)
            VALUES ${docs
            .map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}::jsonb, NOW(), NOW(), FALSE, $${i * 3 + 3})`)
            .join(", ")}
            RETURNING *;
        `;
        const values = docs.flatMap(doc => [doc.id || uuid(), doc.payload, readers]);

        const result = await this.pool.query(query, values);
        return result.rows;
    };

    read = async (id: Id, tokens: string[] = [], createdAt: Date = new Date()): Promise<Envelope> => {
        const query = `
            SELECT *
            FROM ${this.table}
            WHERE id = $1
              AND deleted IS FALSE
              AND created_at <= $2
            ORDER BY created_at DESC
            LIMIT 1;
        `;
        const values = [id, createdAt];
        const result = await this.pool.query(query, values);

        
        const row = result.rows[0];

        if (!row) return row;
        
        return {
            id: row.id,
            payload: row.payload,
            created_at: row.created_at,
            deleted: !!row.deleted,
        };
    };

    readMany = async (ids: Id[], readers: string[] = []): Promise<Envelope[]> => {
        const query = `
            SELECT DISTINCT ON (id) *
            FROM ${this.table}
            WHERE id = ANY($1) AND deleted IS FALSE
            ${readers.length > 0 ? "AND readers && $2" : ""}
            ORDER BY id, created_at DESC;
        `;
        const values = readers.length > 0 ? [ids, readers] : [ids];

        const result = await this.pool.query(query, values);
        return result.rows;
    };

    remove = async (id: Id, readers: string[] = []): Promise<boolean> => {
        const query = `
            UPDATE ${this.table}
            SET deleted = TRUE
            WHERE id = $1
            ${readers.length > 0 ? "AND readers && $2" : ""};
        `;
        const values = readers.length > 0 ? [id, readers] : [id];

        await this.pool.query(query, values);
        return true;
    };

    removeMany = async (ids: Id[], readers: string[] = []): Promise<Record<Id, boolean>> => {
        const query = `
            UPDATE ${this.table}
            SET deleted = TRUE
            WHERE id = ANY($1)
            ${readers.length > 0 ? "AND readers && $2" : ""};
        `;
        const values = readers.length > 0 ? [ids, readers] : [ids];

        await this.pool.query(query, values);

        return ids.reduce((result, id) => {
            result[id] = true;
            return result;
        }, {} as Record<Id, boolean>);
    };

    list = async (readers: string[] = []): Promise<Envelope[]> => {
        const query = `
        SELECT DISTINCT ON (id) *
        FROM ${this.table}
        WHERE deleted IS FALSE
        ${readers.length > 0 ? "AND readers && $1" : ""}
        ORDER BY id, created_at DESC;
    `;
        const values = readers.length > 0 ? [readers] : [];

        const result = await this.pool.query(query, values);

        console.log("List: ", JSON.stringify(result.rows, null, 2))
        return result.rows;
    };
}