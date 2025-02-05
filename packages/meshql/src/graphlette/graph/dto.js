import { processContext, callSubgraph } from './subgraph.js';
import Log4js from 'log4js';
let logger = Log4js.getLogger('gridql/DTOFactory');
export class DTOFactory {
    resolvers = {};
    constructor(config) {
        if (config !== undefined) {
            for (const c of config) {
                try {
                    let url = new URL(c.url);
                    this.resolvers[c.name] = assignResolver(c.id, c.queryName, url);
                }
                catch (e) {
                    logger.error(`Invalid URL: ${c.url}`);
                    throw `Invalid URL: ${c.url}`;
                }
            }
        }
    }
    fillOne(data, timestamp) {
        let copy = { _timestamp: timestamp };
        for (const f in this.resolvers) {
            if (typeof this.resolvers[f] === 'function') {
                copy[f] = this.resolvers[f];
            }
        }
        assignProperties(copy, data);
        return copy;
    }
    fillMany(data, timestamp) {
        return data.map((d) => this.fillOne(d, timestamp));
    }
}
const assignProperties = (target, source) => {
    Object.keys(source).forEach((key) => {
        target[key] = source[key];
    });
};
const assignResolver = (id = 'id', queryName, url) => {
    logger.debug(`Assigning resolver for: ${id}, ${queryName}, ${url}`);
    return async function (parent, args, context) {
        let self = this;
        let foreignKey = self[id];
        const query = processContext(foreignKey, context, queryName, self._timestamp);
        let header = args && args.headers && args.headers.authorization ? args.headers.authorization : null;
        return await callSubgraph(url, query, queryName, header);
    };
};
