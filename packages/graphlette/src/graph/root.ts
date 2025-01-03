import {Repo} from "../repository/repo";
import {DTOFactory} from "./dto";
import {Auth} from "@meshql/auth";
import HandleBars from "handlebars";


export const context = (repo: Repo, authorizer: Auth, config: RootConfig) => {
    let dtoF = new DTOFactory(config.resolvers);
    let rt = root(repo, dtoF, authorizer, config);

    return {
        dtoFactory: dtoF,
        root: rt,
    };
};

export const root = (repo: Repo, dtoFactory: DTOFactory, authorizer:Auth, { singletons, vectors }: RootConfig) => {
    let base: { [key: string]: any } = {};

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
};
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

const vector = (repo: Repo, dtoFactory: DTOFactory, authorizer: Auth, queryTemplate: String) => {
    let qt = HandleBars.compile(queryTemplate)
    return async (args: any, context: any): Promise<Record<string, any>[]> => {
        let token = authorizer.getAuthToken(context)
        let timestamp = getTimestamp(args);
        let payloads: Record<string, any>[] =  await repo.findAll(qt, args, token, timestamp)

        return dtoFactory.fillMany(payloads, token, timestamp).map((v: Record<string, any>) => v.payload)
    }
}

const singleton = (repo: Repo, dtoFactory: DTOFactory, authorizer: Auth, queryTemplate: String) => {
    let qt = HandleBars.compile(queryTemplate)
    return async (args: any, context: any):Promise<Record<string, any>> => {
        let token = await authorizer.getAuthToken(context)
        let timestamp = getTimestamp(args);
        let payload = await repo.find(qt, args, token, timestamp)

        let dto = dtoFactory.fillOne(
            payload,
            token,
            timestamp,
        );

        return dto.payload;
    }
}