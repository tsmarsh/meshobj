import { Pool, types } from "pg";
import { v4 as uuid } from "uuid";
import { Envelope, Id, Repository } from "@meshql/common";

export class PostgresRepository implements Repository<string> {
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
                payload JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                deleted BOOLEAN DEFAULT FALSE,
                authorized_tokens TEXT[]
            );
        `;
        await this.pool.query(query);
    }

    create = async (doc: Envelope<string>): Promise<Envelope<string>> => {
        const query = `
            INSERT INTO ${this.table} (id, payload, created_at, authorized_tokens)
            VALUES ($1, $2::jsonb, NOW(), $3)
            RETURNING *;
        `;
        const id = doc.id || uuid();
        const values = [id, doc.payload, doc.authorized_tokens || []];

        const result = await this.pool.query(query, values);

        let row = result.rows[0];
        return row;
    };

    createMany = async (docs: Envelope<string>[]): Promise<Envelope<string>[]> => {
        const query = `
            INSERT INTO ${this.table} (id, payload, created_at, authorized_tokens)
            VALUES ${docs
            .map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}::jsonb, NOW(), $${i * 3 + 3})`)
            .join(", ")}
            RETURNING *;
        `;
        const values = docs.flatMap(doc => [doc.id || uuid(), doc.payload, doc.authorized_tokens || []]);

        const result = await this.pool.query(query, values);
        return result.rows;
    };

    read = async (id: Id<string>, tokens: string[] = []): Promise<Envelope<string>> => {
        const query = `
            SELECT * FROM ${this.table}
            WHERE id = $1 AND deleted IS FALSE
            ${tokens.length > 0 ? "AND authorized_readers && $2" : ""}
            ORDER BY created_at DESC
            LIMIT 1;
        `;
        const values = tokens.length > 0 ? [id, tokens] : [id];

        const result = await this.pool.query(query, values);
        return result.rows[0];
    };

    readMany = async (ids: Id<string>[], tokens: string[] = []): Promise<Envelope<string>[]> => {
        const query = `
            SELECT DISTINCT ON (id) *
            FROM ${this.table}
            WHERE id = ANY($1) AND deleted IS FALSE
            ${tokens.length > 0 ? "AND authorized_readers && $2" : ""}
            ORDER BY id, created_at DESC;
        `;
        const values = tokens.length > 0 ? [ids, tokens] : [ids];

        const result = await this.pool.query(query, values);
        return result.rows;
    };

    remove = async (id: Id<string>, tokens: string[] = []): Promise<boolean> => {
        const query = `
            UPDATE ${this.table}
            SET deleted = TRUE
            WHERE id = $1
            ${tokens.length > 0 ? "AND authorized_readers && $2" : ""};
        `;
        const values = tokens.length > 0 ? [id, tokens] : [id];

        await this.pool.query(query, values);
        return true;
    };

    removeMany = async (ids: Id<string>[], tokens: string[] = []): Promise<Record<Id<string>, boolean>> => {
        const query = `
            UPDATE ${this.table}
            SET deleted = TRUE
            WHERE id = ANY($1)
            ${tokens.length > 0 ? "AND authorized_readers && $2" : ""};
        `;
        const values = tokens.length > 0 ? [ids, tokens] : [ids];

        await this.pool.query(query, values);

        return ids.reduce((result, id) => {
            result[id] = true;
            return result;
        }, {} as Record<Id<string>, boolean>);
    };

    list = async (tokens: string[] = []): Promise<Envelope<string>[]> => {
        const query = `
        SELECT DISTINCT ON (id) *
        FROM ${this.table}
        WHERE deleted IS FALSE
        ${tokens.length > 0 ? "AND authorized_readers && $1" : ""}
        ORDER BY id, created_at DESC;
    `;
        const values = tokens.length > 0 ? [tokens] : [];

        const result = await this.pool.query(query, values);
        
        return result.rows;
    };
}