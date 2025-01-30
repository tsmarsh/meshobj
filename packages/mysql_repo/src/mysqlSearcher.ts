import { Pool, RowDataPacket } from "mysql2/promise";
import { Payload, Searcher } from "@meshql/common";
import { TemplateDelegate } from "handlebars";
import Log4js from "log4js";

const logger = Log4js.getLogger("meshql/mysql_searcher");

interface MySQLRow extends RowDataPacket {
    id: string;
    payload: string;
    created_at: Date;
    deleted: boolean;
}

export class MySQLSearcher implements Searcher {
    private pool: Pool;
    private table: string;

    constructor(pool: Pool, table: string) {
        this.pool = pool;
        this.table = table;
    }

    async find(
        queryTemplate: TemplateDelegate<Record<string, unknown>>,
        args: Record<string, unknown>,
        creds?: string[],
        timestamp?: number
    ): Promise<Record<string, unknown>> {
        const searchQuery = queryTemplate(args);
        const createdAt = timestamp ? new Date(timestamp) : new Date();

        // Convert the search query from MongoDB format to MySQL JSON search
        const mysqlQuery = this.convertMongoToMySQLQuery(searchQuery);

        const query = `
            SELECT id, payload, created_at, deleted
            FROM ${this.table}
            WHERE ${mysqlQuery}
              AND deleted = FALSE
              AND created_at <= ?
              ${creds?.length ? 'AND JSON_OVERLAPS(authorized_tokens, CAST(? AS JSON))' : ''}
            ORDER BY created_at DESC
            LIMIT 1;
        `;

        const values = creds?.length 
            ? [createdAt, JSON.stringify(creds)]
            : [createdAt];

        try {
            const [rows] = await this.pool.query<MySQLRow[]>(query, values);
            if (!rows.length) return {};

            const row = rows[0];
            return {
                id: row.id,
                payload: row.payload as unknown as Payload,
                created_at: row.created_at,
                deleted: row.deleted,
            };
        } catch (err) {
            logger.error(`Search error: ${err}`);
            return {};
        }
    }

    async findAll(
        queryTemplate: TemplateDelegate<Record<string, unknown>>,
        args: Record<string, unknown>,
        creds?: string[],
        timestamp?: number
    ): Promise<Record<string, unknown>[]> {
        const searchQuery = queryTemplate(args);
        const createdAt = timestamp ? new Date(timestamp) : new Date();

        // Convert the search query from MongoDB format to MySQL JSON search
        const mysqlQuery = this.convertMongoToMySQLQuery(searchQuery);

        const query = `
            SELECT DISTINCT id,
                   FIRST_VALUE(payload) OVER w AS payload,
                   FIRST_VALUE(created_at) OVER w AS created_at,
                   FIRST_VALUE(deleted) OVER w AS deleted
            FROM ${this.table}
            WHERE ${mysqlQuery}
              AND deleted = FALSE
              AND created_at <= ?
              ${creds?.length ? 'AND JSON_OVERLAPS(authorized_tokens, CAST(? AS JSON))' : ''}
            WINDOW w AS (PARTITION BY id ORDER BY created_at DESC)
            ORDER BY created_at DESC;
        `;

        const values = creds?.length 
            ? [createdAt, JSON.stringify(creds)]
            : [createdAt];

        try {
            const [rows] = await this.pool.query<MySQLRow[]>(query, values);
            return rows.map(row => ({
                id: row.id,
                payload: row.payload as unknown as Payload,
                created_at: row.created_at,
                deleted: row.deleted,
            }));
        } catch (err) {
            logger.error(`Search error: ${err}`);
            return [];
        }
    }

    private convertMongoToMySQLQuery(mongoQuery: string): string {
        try {
            const query = JSON.parse(mongoQuery);
            const conditions: string[] = [];

            for (const [key, value] of Object.entries(query)) {
                if (key === 'id') {
                    conditions.push(`id = ${this.pool.escape(value)}`);
                } else if (key.startsWith('payload.')) {
                    const path = key.replace('payload.', '');
                    conditions.push(`JSON_EXTRACT(payload, '$.${path}') = ${this.pool.escape(value)}`);
                }
            }

            return conditions.join(' AND ') || '1=1';
        } catch (err) {
            logger.error(`Query conversion error: ${err}`);
            return '1=1';
        }
    }
} 