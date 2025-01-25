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
    PostgresConfig,
} from "./configTypes";
import {
    Envelope,
    Repository,
    Searcher,
    Validator,
} from "@meshql/common";
import { Pool } from "pg";
import { Collection, MongoClient } from "mongodb";
import { Crud } from "@meshql/restlette";
import { JSONSchemaValidator } from "@meshql/restlette";
import { JWTSubAuthorizer } from "@meshql/jwt_auth";
import { Auth } from "@meshql/auth";
import { CasbinAuth } from "@meshql/casbin_auth";
import cors from 'cors';

// Import our new helper factories
import { createMongoSearcher, createMongoRepository } from "./helpers/mongo";
import { createSQLiteSearcher, createSQLiteRepository } from "./helpers/sqlite";
import { createPostgresSearcher, createPostgresRepository } from "./helpers/postgres";

let port = 3030;

let pools: Pool[] = [];
let clients: MongoClient[] = [];

async function buildMongoCollection(mongoConfig: MongoConfig) {
    const client = new MongoClient(mongoConfig.uri);
    clients.push(client);
    await client.connect();
    const mongoDb = client.db(mongoConfig.db);
    const collection: Collection<Envelope> = mongoDb.collection(
        mongoConfig.collection
    );
    return collection;
}

// New helper to build a Postgres Pool
function buildPostgresPool(config: PostgresConfig): Pool {
    const pool = new Pool({
        host: config.host,
        port: config.port,
        database: config.db,
        user: config.user,
        password: config.password,
    });
    pools.push(pool);
    return pool;
}

async function processGraphlette(
    graphlette: Graphlette,
    auth: Auth,
    app: Application
) {
    const { schema, storage, path, rootConfig } = graphlette;

    const dtoFactory = new DTOFactory(rootConfig.resolvers);
    let searcher: Searcher;

    switch (storage.type) {
        case "mongo":
            searcher = await createMongoSearcher(
                storage as MongoConfig,
                dtoFactory,
                auth
            );
            break;
        case "sql":
            searcher = await createSQLiteSearcher(
                storage as SQLConfig,
                dtoFactory,
                auth
            );
            break;
        case "postgres":
            searcher = createPostgresSearcher(
                storage as PostgresConfig,
                dtoFactory,
                auth
            );
            break;
    }

    const rt = root(searcher, dtoFactory, auth, rootConfig);
    graph_init(app, schema, path, rt);
}

async function buildRepository(storage: StorageConfig): Promise<Repository> {
    switch (storage.type) {
        case "mongo":
            return createMongoRepository(storage as MongoConfig);
        case "sql":
            return createSQLiteRepository(storage as SQLConfig);
        case "postgres":
            return createPostgresRepository(storage as PostgresConfig);
    }
}

async function processRestlette(
    restlette: Restlette,
    auth: Auth,
    app: Application,
    port: number
) {
    const validator: Validator = JSONSchemaValidator(restlette.schema);
    const repo: Repository = await buildRepository(restlette.storage);
    const crud = new Crud(auth, repo, validator, restlette.path, restlette.tokens);
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

    const app: Application = express();
    app.use(express.json());

    // Use CORS middleware
    app.use(cors({
        origin: '*', // Allow all origins. Adjust as needed for security.
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    }));

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

export async function cleanServer() {
    console.log("Cleaning server");
    let count = 1;
    for (const client of clients) {
        console.log(`Closing client ${count}`);
        await client.close();
        count++;
    }
    for (const pool of pools) {
        console.log(`Closing pool ${count}`);
        await pool.end();
        count++;
    }
}