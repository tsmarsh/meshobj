import { DTOFactory } from './dto.js';
import HandleBars from 'handlebars';
import Log4js from 'log4js';
const logger = Log4js.getLogger('meshql/graphlette/root');
export function context(repo, authorizer, config) {
    let dtoF = new DTOFactory(config.resolvers);
    let rt = root(repo, dtoF, authorizer, config);
    return {
        dtoFactory: dtoF,
        root: rt,
    };
}
export function root(repo, dtoFactory, authorizer, { singletons, vectors }) {
    let base = {};
    if (singletons !== undefined) {
        for (const s of singletons) {
            base[s.name] = singleton(repo, dtoFactory, authorizer, s.query, s.name);
        }
    }
    if (vectors !== undefined) {
        for (const s of vectors) {
            base[s.name] = vector(repo, dtoFactory, authorizer, s.query, s.name);
        }
    }
    return base;
}
const getTimestamp = (args) => {
    let atArg = 'at';
    let at;
    if (Object.hasOwnProperty.call(args, atArg)) {
        at = args['at'];
    }
    else {
        at = Date.now();
    }
    return at;
};
function vector(repo, dtoFactory, authorizer, queryTemplate, name) {
    let qt = HandleBars.compile(queryTemplate);
    return async (args, context) => {
        let creds = await authorizer.getAuthToken(context);
        let timestamp = getTimestamp(args);
        let results = await repo.findAll(qt, args, creds, timestamp);
        // let payloads = results.map((v: Record<string, any>) => v)
        let filledResult = dtoFactory.fillMany(results, timestamp);
        logger.trace(`${name} Results ${JSON.stringify(filledResult)} for ${queryTemplate}, ${JSON.stringify(args)}`);
        return filledResult;
    };
}
function singleton(repo, dtoFactory, authorizer, queryTemplate, name) {
    let qt = HandleBars.compile(queryTemplate);
    return async (args, context) => {
        let creds = await authorizer.getAuthToken(context);
        let timestamp = getTimestamp(args);
        let payload = await repo.find(qt, args, creds, timestamp);
        logger.trace(`${name} DB Result ${JSON.stringify(payload)} for ${queryTemplate}, ${JSON.stringify(args)}`);
        let filled = dtoFactory.fillOne(payload, timestamp);
        logger.trace(`${name} Result ${JSON.stringify(filled)} for ${queryTemplate}, ${JSON.stringify(args)}`);
        return filled;
    };
}
