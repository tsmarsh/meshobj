import { Searcher, Envelope } from "@meshql/common";
import { Auth } from "@meshql/auth";
import { DTOFactory } from "@meshql/graphlette";
import Handlebars from "handlebars";
import { Database } from "sqlite";
import { getLogger } from "log4js";

let logger = getLogger("meshql/sqlitesearcher");

export class SQLiteSearcher implements Searcher<string> {
    private db: Database;
    private authorizer: Auth;
    private dtoFactory: DTOFactory;

    constructor(db: Database, dtoFactory: DTOFactory, authorizer: Auth) {
        this.db = db;
        this.dtoFactory = dtoFactory;
        this.authorizer = authorizer;
    }

    processQueryTemplate(parameters: Record<string, any>, queryTemplate: Handlebars.TemplateDelegate): string {
        return queryTemplate(parameters);
    }

    async find(queryTemplate: Handlebars.TemplateDelegate, args: Record<string, any>, creds: string[] = [], timestamp: number = Date.now()): Promise<Record<string, any>> {
        args._createdAt = timestamp;
        let sql = this.processQueryTemplate(args, queryTemplate);

        const result = await this.db.get(sql, []);

        if (result && result.payload) {
            result.payload = JSON.parse(result.payload);

            if (await this.authorizer.isAuthorized(creds, result)) {

                result.payload.id = result.id;
                return this.dtoFactory.fillOne(result.payload, timestamp);
            }
        }

        return {};
    }

    async findAll(queryTemplate: Handlebars.TemplateDelegate, args: Record<string, any>, creds: string[] = [], timestamp: number = Date.now()): Promise<Record<string, any>[]> {
        args._createdAt = timestamp;
        let sql = this.processQueryTemplate(args, queryTemplate);

        const rows = await this.db.all(sql, []);
        const envelopes: Envelope<string>[] = rows.map((i) => i.payload = JSON.parse(i.payload));

        const authorizedResults = rows.filter((row) => this.authorizer.isAuthorized(creds, row));

        return authorizedResults.map((row) => {
            const result = row as Envelope<string>;
            result.payload.id = result.id;
            return result.payload;
        });
    }
}