import {Searcher} from "@meshql/common";
import {Auth} from "@meshql/auth";
import {Collection, Document, WithId} from "mongodb";
import {DTOFactory} from "@meshql/graphlette";
import HandleBars from "handlebars";
import Handlebars from "handlebars";
import {getLogger} from "log4js";
import {QueryArgs, Schema} from "./types";

let logger = getLogger("meshql/mongosearcher");

export class MongoSearcher implements Searcher {
    private authorizer: Auth;
    private db: Collection;
    private dtoFactory: DTOFactory;

    constructor(db: Collection, dtoFactory: DTOFactory, authorizer: Auth) {
        this.authorizer = authorizer;
        this.db = db;
        this.dtoFactory = dtoFactory;
    }

    processQueryTemplate(parameters: any, queryTemplate: HandleBars.Template): any {
        let query = queryTemplate(parameters);
        let json;

        try {
            json = JSON.parse(query);
        } catch (e) {
            logger.error(
                `Failed to create query:
      Query Template: ${queryTemplate}
      parameters: ${parameters}
      Updated Query: ${query}
    `,
            );
            throw e;
        }
        return json;
    };

    async find(queryTemplate: Handlebars.Template, args: QueryArgs, timestamp: number = Date.now()): Promise<Record<string, any>> {
        let query = this.processQueryTemplate(args, queryTemplate);

        query.createdAt = {
            $lt: new Date(timestamp),
        };

        this.db.find(query).sort({createdAt: -1}).toArray()
            .catch(() => {
                logger.debug(`Nothing found for: ${args}`);
                return [];
            }).then((doc: WithId<Document>[]) => {
            let result = doc as Schema;

            if (
                args === undefined ||
                this.authorizer.isAuthorized(args.req, result)
            ) {
                result.payload.id = result.id;
                return this.dtoFactory.fillOne(
                    result.payload,
                    timestamp,
                );
            } else {
                return {};
            }
        })
    };

    async findAll(queryTemplate: Handlebars.Template, args: QueryArgs, timestamp: number = Date.now()): Promise<Record<string, any>> {
        let time_filter = {
            $lt: new Date(timestamp),
        };

        let query = this.processQueryTemplate(args, queryTemplate);

        query.createdAt = time_filter;

        let results = await this.db
            .aggregate([
                {
                    $match: query,
                },
                {
                    $sort: {createdAt: -1},
                },
                {
                    $group: {
                        _id: "$id",
                        doc: {$first: "$$ROOT"},
                    },
                },
                {
                    $replaceRoot: {newRoot: "$doc"},
                },
            ])
            .toArray();

        if (args !== undefined) {
            results = results.filter((r:Document) => this.authorizer.isAuthorized(args.req, r));
        }
        return results.map((d) => {
            let r = d as Schema
            r.payload.id = r.id;
            return r.payload;
        })
    };
}