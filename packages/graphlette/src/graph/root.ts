import {DTOFactory} from "./dto.js";
import HandleBars from "handlebars";
import {Searcher, RootConfig} from "@meshql/common";
import {Auth} from "@meshql/auth";

export function context<T> (repo: Searcher<T>, authorizer: Auth, config: RootConfig) {
    let dtoF = new DTOFactory(config.resolvers);
    let rt = root(repo, dtoF, authorizer, config);

    return {
        dtoFactory: dtoF,
        root: rt,
    };
};

export function root<T>(repo: Searcher<T>, dtoFactory: DTOFactory, authorizer:Auth, { singletons, vectors }: RootConfig){
    let base: Record<string, any> = {};

    if (singletons !== undefined) {
        for (const s of singletons) {
            base[s.name] = singleton(repo, dtoFactory, authorizer, s.query);
        }
    }

    if (vectors !== undefined) {
        for (const s of vectors) {
            base[s.name] = vector(repo, dtoFactory, authorizer, s.query);
        }
    }

    return base;
}

const getTimestamp = (args: Record<string, any>): number => {
    let atArg = "at";
    let at;
    if (Object.hasOwnProperty.call(args, atArg)) {
        at = args["at"];
    } else {
        at = Date.now();
    }

    return at;
}

function vector<T> (repo: Searcher<T>, dtoFactory: DTOFactory, authorizer: Auth, queryTemplate: String){
    let qt = HandleBars.compile(queryTemplate)
    return async (args: any, context: any): Promise<Record<string, any>[]> => {
        let creds = await authorizer.getAuthToken(context);
        let timestamp = getTimestamp(args);
        let results: Record<string, any>[] =  await repo.findAll(qt, args, creds, timestamp)
        let payloads = results.map((v: Record<string, any>) => v)
        return dtoFactory.fillMany(payloads, timestamp);
    }
}

function singleton<T> (repo: Searcher<T>, dtoFactory: DTOFactory, authorizer: Auth, queryTemplate: String) {
    let qt = HandleBars.compile(queryTemplate)
    return async (args: any, context: any):Promise<Record<string, any>> => {
        let creds = await authorizer.getAuthToken(context);
        let timestamp = getTimestamp(args);
        let payload = await repo.find(qt, args, creds, timestamp)

        return dtoFactory.fillOne(
            payload,
            timestamp,
        );
    }
}