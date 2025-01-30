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
    MySQLConfig,
} from "./configTypes";
import {
    Envelope,
    Repository,
    Searcher,
    Validator,
} from "@meshql/common";
import { Pool } from "pg";
import { Collection, MongoClient } from "mongodb";
import { Pool as MySQLPool, createPool } from "mysql2/promise";
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
import { MySQLRepository, MySQLSearcher } from "@meshql/mysql_repo";

let port = 3030;

let pgPools: Pool[] = [];
let mysqlPools: MySQLPool[] = [];
let clients: MongoClient[] = [];

async function buildMongoCollection(mongoConfig: MongoConfig) {
    const client = new MongoClient(mongoConfig.uri);
    await client.connect();
    const mongoDb = client.db(mongoConfig.db);
    const collection: Collection<Envelope> = mongoDb.collection(
        mongoConfig.collection
    );
    return collection;
}

// New helper to build a Postgres Pool
function buildPostgresPool(config: PostgresConfig): Pool {
    let p =  new Pool({
        host: config.host,
        port: config.port,
        database: config.db,
        user: config.user,
        password: config.password,
    });
    pgPools.push(p);
    return p;
}


function buildMySQLPool(config: MySQLConfig): MySQLPool {
    const p = createPool({
        host: config.host,
        port: config.port,
        database: config.db,
        user: config.user,
        password: config.password,
        waitForConnections: true,
        connectionLimit: 10,
        maxIdle: 10,
        idleTimeout: 60000,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0
    });
    mysqlPools.push(p);
    return p;
}
function createMySQLSearcher(config: MySQLConfig, dtoFactory: DTOFactory, auth: Auth): Searcher {
    const pool = buildMySQLPool(config);
    return new MySQLSearcher(pool, config.table);
}

function createMySQLRepository(config: MySQLConfig): Repository {
    const pool = buildMySQLPool(config);
    const repo = new MySQLRepository(pool, config.table);
    repo.initialize().catch(err => {
        console.error(`Failed to initialize MySQL repository: ${err}`);
    });
    return repo;
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
        case "mysql":
            searcher = createMySQLSearcher(
                storage as MySQLConfig,
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
        case "mysql":
            return createMySQLRepository(storage as MySQLConfig);
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

    const app = express();
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
    for (const pool of pgPools) {
        console.log(`Closing PostgreSQL pool ${count}`);
        await pool.end();
        count++;
    }
    for (const pool of mysqlPools) {
        console.log(`Closing MySQL pool ${count}`);
        await pool.end();
        count++;
    }
}