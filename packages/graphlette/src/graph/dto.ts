import { processContext, callSubgraph } from "./subgraph.js";
import {IncomingMessage} from "http";
import Log4js from "log4js";
import {GraphQLArgs} from "graphql/graphql";
import {Resolver} from "@meshql/common"

let logger = Log4js.getLogger("gridql/DTOFactory");

export class DTOFactory {
    resolvers: { [key: string]: any } = {};

    constructor(config?: Resolver[]) {
        if (config !== undefined) {
            for (const c of config) {
                this.resolvers[c.name] = assignResolver(c.id, c.queryName, new URL(c.url));
            }
        }
    }

    fillOne(data: Record<string, any>, timestamp: number) : Record<string, any>{
        let copy: { [key: string]: any } = {_timestamp: timestamp };

        for (const f in this.resolvers) {
            if (typeof this.resolvers[f] === "function") {
                copy[f] = this.resolvers[f];
            }
        }

        assignProperties(copy, data);
        return copy;
    }

    fillMany(data: Record<string, any>, timestamp: number) : Record<string, any>[]{
        return data.map((d: Record<string, any>) => this.fillOne(d, timestamp));
    }
}

const assignProperties = (target: { [key: string]: any }, source: { [key: string]: any }): void => {
    Object.keys(source).forEach((key):void => {
        target[key] = source[key];
    });
};

const assignResolver = (id: string = "id", queryName: string, url: URL) : Record<string, any> => {
    logger.debug(`Assigning resolver for: ${id}, ${queryName}, ${url}`);
    return async function (this: { [key: string]: any }, parent: any, args: IncomingMessage, context: GraphQLArgs): Promise<Record<string, any>> {
        let self = this as { [key: string]: any }
        let foreignKey: any = self[id];
        const query: string = processContext(
            foreignKey,
            context,
            queryName,
            self._timestamp,
        );
        let header =
             args && args.headers && args.headers.authorization  ? args.headers.authorization : null;
        return await callSubgraph(url, query, queryName, header);
    };
};
