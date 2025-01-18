import { Searcher, Envelope } from "@meshql/common";
import { Auth } from "@meshql/auth";
import { DTOFactory } from "@meshql/graphlette";
import Handlebars from "handlebars";
import { getLogger } from "log4js";
import { Pool } from "pg";

const logger = getLogger("meshql/postgressearcher");

export class PostgresSearcher implements Searcher<string> {
    private pool: Pool;
    private table: string;
    private authorizer: Auth;
    private dtoFactory: DTOFactory;

    constructor(pool: Pool, table: string, dtoFactory: DTOFactory, authorizer: Auth) {
        this.pool = pool;
        this.table = table;
        this.dtoFactory = dtoFactory;
        this.authorizer = authorizer;
    }

    /**
     * Processes a Handlebars template with the provided parameters.
     */
    processQueryTemplate(parameters: Record<string, any>, queryTemplate: Handlebars.TemplateDelegate): string {
        return queryTemplate(parameters);
    }

    /**
     * Finds a single record based on the query template and arguments.
     */
    async find(
        queryTemplate: Handlebars.TemplateDelegate,
        args: Record<string, any>,
        creds: string[] = [],
        timestamp: number = Date.now()
    ): Promise<Record<string, any>> {
        args._createdAt = new Date(timestamp).toISOString();
        args._name = this.table;

        const sql = this.processQueryTemplate(args, queryTemplate);

        try {
            const result = await this.pool.query(sql);

            if (result.rows.length > 0) {
                let row = result.rows[0];

                if (await this.authorizer.isAuthorized(creds, row)) {
                    row.payload.id = row.id;
                    return this.dtoFactory.fillOne(row.payload, timestamp);
                }
            }
        } catch (err) {
            logger.error(`Error executing find query: ${err}`);
        }

        return {};
    }

    /**
     * Finds all records based on the query template and arguments.
     */
    async findAll(
        queryTemplate: Handlebars.TemplateDelegate,
        args: Record<string, any>,
        creds: string[] = [],
        timestamp: number = Date.now()
    ): Promise<Record<string, any>[]> {
        args._createdAt = new Date(timestamp).toISOString();
        args._name = this.table;
        const sql = this.processQueryTemplate(args, queryTemplate);

        try {
            const result = await this.pool.query(sql);

            const authorizedResults = result.rows.filter((row) => this.authorizer.isAuthorized(creds, row));

            return authorizedResults.map((row) => {
                row.payload.id = row.id;
                return row.payload;
            });
        } catch (err) {
            logger.error(`Error executing findAll query: ${err}`);
        }

        return [];
    }
}