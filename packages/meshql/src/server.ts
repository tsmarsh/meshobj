import {DTOFactory, root, init as graph_init} from "@meshql/graphlette"
import {init as rest_init} from "@meshql/restlette"
import fastify, {FastifyInstance} from "fastify";
import {Config, Graphlette, MongoConfig, Restlette, SQLConfig} from "./configTypes"
import {Envelope, Repository, RootConfig, Searcher, Validator} from "@meshql/common";
import {MongoSearcher, PayloadRepository} from "@meshql/mongo_repo";
import {SQLiteSearcher} from "@meshql/sqlite_repo/src/sqliteSearcher";
import {open} from "sqlite";
import sqlite3 from "sqlite3";
import {Collection, MongoClient} from "mongodb";
import {Crud} from "@meshql/restlette/src/crud";
import {JSONSchemaValidator} from "@meshql/restlette/src/validation";
import {SQLiteRepository} from "@meshql/sqlite_repo/src/sqliteRepo";
import {JWTSubAuthorizer} from "@meshql/jwt_auth";
import {Auth} from "@meshql/auth";
import {CasbinAuth} from "@meshql/casbin_auth";

let port = 3030;

async function buildMongoCollection(mongoConfig: MongoConfig) {
    let client: MongoClient = new MongoClient(mongoConfig.uri);
    await client.connect();
    let mongoDb = client.db(mongoConfig.db)
    let collection: Collection<Envelope<string>> = mongoDb.collection(mongoConfig.collection);
    return collection;
}

async function processGraphlette(graphlette: Graphlette, auth: Auth, app: FastifyInstance) {
    let schema = graphlette.schema;
    let storage = graphlette.storage;

    let searcher: Searcher<any>;

    let dtoFactory:DTOFactory = new DTOFactory(graphlette.rootConfig.resolvers);

    switch (storage.type) {
        case "mongo":
            let mongoConfig = storage as MongoConfig;
            let collection = await buildMongoCollection(mongoConfig);

            searcher = new MongoSearcher(collection, dtoFactory, auth)
            break;
        case "sql":
            let sqlConfig = storage as SQLConfig;
            let lite = await open({filename: sqlConfig.uri, driver: sqlite3.Database});
            searcher = new SQLiteSearcher(lite, dtoFactory, auth)
            break;
        case "memory":
            throw "Unsupported"
    }

    let rt = root(searcher, dtoFactory, auth, graphlette.rootConfig);
    graph_init(app, schema, rt);
}

async function processRestlette(restlette: Restlette, auth: Auth, app: FastifyInstance) {
    let validator: Validator = JSONSchemaValidator(JSON.parse(restlette.schema));

    let storage = restlette.storage;
    let repo: Repository<any>;

    switch (storage.type) {
        case "mongo":
            let mongoConfig = storage as MongoConfig;
            let collection = await buildMongoCollection(mongoConfig);

            repo = new PayloadRepository(collection)
            break;
        case "sql":
            let sqlConfig = storage as SQLConfig;
            let lite = await open({filename: sqlConfig.uri, driver: sqlite3.Database});

            repo = new SQLiteRepository(lite, storage.collection);
            break;
    }

    let crud = new Crud(auth, repo, validator, restlette.path, restlette.tokens);
    rest_init(app, crud, restlette.path);
}

async function processAuth(config: Config): Promise<Auth> {
    let jwtSubAuthorizer: Auth = new JWTSubAuthorizer();
    if (config.casbinParams) {
        return CasbinAuth.create(config.casbinParams, jwtSubAuthorizer);
    } else {
        return jwtSubAuthorizer;
    }
}

export async function init(config: Config): Promise<FastifyInstance> {
    port = config.port;
    let auth:Auth = await processAuth(config);

    let app: FastifyInstance = fastify();

    for(let graphlette of config.graphlettes) {
        await processGraphlette(graphlette, auth, app);
    }
    for(let restlette of config.restlettes){
        await processRestlette(restlette, auth, app);
    }

    return app;
}