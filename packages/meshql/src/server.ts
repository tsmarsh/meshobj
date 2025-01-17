import express, { Application } from "express";
import { DTOFactory, root, init as graph_init } from "@meshql/graphlette";
import { init as rest_init } from "@meshql/restlette";
import {
    Config,
    Graphlette,
    MongoConfig,
    Restlette,
    SQLConfig,
    StorageConfig,
} from "./configTypes";
import {
    Envelope,
    Repository,
    Searcher,
    Validator,
} from "@meshql/common";
import { MongoSearcher, PayloadRepository } from "@meshql/mongo_repo";
import { SQLiteSearcher } from "@meshql/sqlite_repo";
import { open } from "sqlite";
import sqlite3 from "sqlite3";
import { Collection, MongoClient } from "mongodb";
import { Crud } from "@meshql/restlette";
import { JSONSchemaValidator } from "@meshql/restlette";
import { SQLiteRepository } from "@meshql/sqlite_repo";
import { JWTSubAuthorizer } from "@meshql/jwt_auth";
import { Auth } from "@meshql/auth";
import { CasbinAuth } from "@meshql/casbin_auth";
import { InMemory } from "@meshql/memory_repo";

let port = 3030;

async function buildMongoCollection(mongoConfig: MongoConfig) {
    const client = new MongoClient(mongoConfig.uri);
    await client.connect();
    const mongoDb = client.db(mongoConfig.db);
    const collection: Collection<Envelope<string>> = mongoDb.collection(
        mongoConfig.collection
    );
    return collection;
}

async function processGraphlette(
    graphlette: Graphlette,
    auth: Auth,
    app: Application
) {
    const { schema, storage, path, rootConfig } = graphlette;

    let searcher: Searcher<any>;
    const dtoFactory = new DTOFactory(rootConfig.resolvers);

    switch (storage.type) {
        case "mongo": {
            const mongoConfig = storage as MongoConfig;
            const collection = await buildMongoCollection(mongoConfig);
            searcher = new MongoSearcher(collection, dtoFactory, auth);
            break;
        }
        case "sql": {
            const sqlConfig = storage as SQLConfig;
            const lite = await open({
                filename: sqlConfig.uri,
                driver: sqlite3.Database,
            });
            searcher = new SQLiteSearcher(lite, dtoFactory, auth);
            break;
        }
        case "memory":
            throw new Error("Unsupported storage type: memory");
    }

    const rt = root(searcher, dtoFactory, auth, rootConfig);
    graph_init(app, schema, path, rt);
}

async function buildRepository(storage: StorageConfig): Promise<Repository<any>> {
    switch (storage.type) {
        case "mongo": {
            const mongoConfig = storage as MongoConfig;
            const collection = await buildMongoCollection(mongoConfig);
            return new PayloadRepository(collection);
        }
        case "sql": {
            const sqlConfig = storage as SQLConfig;
            const lite = await open({
                filename: sqlConfig.uri,
                driver: sqlite3.Database,
            });
            let sqLiteRepository = new SQLiteRepository(lite, sqlConfig.collection);
            sqLiteRepository.initialize();
            return sqLiteRepository;
        }
        case "memory":
            return new InMemory();
    }
}

async function processRestlette(
    restlette: Restlette,
    auth: Auth,
    app: Application,
    port: number
) {
    const validator: Validator = JSONSchemaValidator(restlette.schema);
    const repo: any = await buildRepository(restlette.storage);
    const crud: any = new Crud(auth, repo, validator, restlette.path, restlette.tokens);
    rest_init(app, crud, restlette.path, port, restlette.schema);
}

async function processAuth(config: Config): Promise<Auth> {
    const jwtSubAuthorizer: Auth = new JWTSubAuthorizer();
    if (config.casbinParams) {
        return CasbinAuth.create(config.casbinParams, jwtSubAuthorizer);
    } else {
        return jwtSubAuthorizer;
    }
}

export async function init(config: Config): Promise<Application> {
    port = config.port;
    const auth: Auth = await processAuth(config);

    const app = express();
    app.use(express.json());

    // Process graphlettes
    for (const graphlette of config.graphlettes) {
        await processGraphlette(graphlette, auth, app);
    }

    // Process restlettes
    for (const restlette of config.restlettes) {
        await processRestlette(restlette, auth, app, config.port);
    }

    // Swagger setup
    const swaggerDocument = {
        openapi: "3.0.0",
        info: {
            title: "API Documentation",
            version: "1.0.0",
        },
        servers: [{ url: `http://localhost:${port}` }],
    };

    return app;
}
