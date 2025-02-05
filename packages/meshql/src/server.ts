import express, { Application } from 'express';
import { DTOFactory, root, init as graph_init } from '@meshql/graphlette';
import { init as rest_init } from '@meshql/restlette';
import {
    Config,
    Graphlette,
    MongoConfig,
    Restlette,
    SQLConfig,
    StorageConfig,
    PostgresConfig,
    MySQLConfig,
} from './configTypes';
import { Repository, Searcher, Validator } from '@meshql/common';
import { Pool } from 'pg';
import { MongoClient } from 'mongodb';
import { Crud } from '@meshql/restlette';
import { JSONSchemaValidator } from '@meshql/restlette';
import { JWTSubAuthorizer } from '@meshql/jwt_auth';
import { Auth } from '@meshql/auth';
import { CasbinAuth } from '@meshql/casbin_auth';
import cors from 'cors';

// Import our new helper factories
import { createMongoSearcher, createMongoRepository } from './helpers/mongo';
import { createSQLiteSearcher, createSQLiteRepository } from './helpers/sqlite';
import { createPostgresSearcher, createPostgresRepository } from './helpers/postgres';
import { createMySQLRepository, createMySQLSearcher } from './helpers/mysql';
import { Pool as MySQLPool } from 'mysql2/promise';

let pools: Record<string, Pool> = {};
let clients: Record<string, MongoClient> = {};
let mysqlPools: Record<string, MySQLPool> = {};

async function processGraphlette(graphlette: Graphlette, auth: Auth, app: Application) {
    const { schema, storage, path, rootConfig } = graphlette;

    const dtoFactory = new DTOFactory(rootConfig.resolvers);
    let searcher: Searcher;

    switch (storage.type) {
        case 'mongo':
            searcher = await createMongoSearcher(storage as MongoConfig, dtoFactory, auth, clients);
            break;
        case 'sql':
            searcher = await createSQLiteSearcher(storage as SQLConfig, dtoFactory, auth);
            break;
        case 'postgres':
            searcher = createPostgresSearcher(storage as PostgresConfig, dtoFactory, auth, pools);
            break;
        case 'mysql':
            searcher = createMySQLSearcher(storage as MySQLConfig, dtoFactory, auth, mysqlPools);
    }

    const rt = root(searcher, dtoFactory, auth, rootConfig);
    graph_init(app, schema, path, rt);
}

async function buildRepository(storage: StorageConfig): Promise<Repository> {
    switch (storage.type) {
        case 'mongo':
            return createMongoRepository(storage as MongoConfig, clients);
        case 'sql':
            return createSQLiteRepository(storage as SQLConfig);
        case 'postgres':
            return createPostgresRepository(storage as PostgresConfig, pools);
        case 'mysql':
            return createMySQLRepository(storage as MySQLConfig, mysqlPools);
    }
}

async function processRestlette(restlette: Restlette, auth: Auth, app: Application, port: number) {
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
    const auth: Auth = await processAuth(config);

    const app: Application = express();
    app.use(express.json());

    // Use CORS middleware
    app.use(
        cors({
            origin: '*', // Allow all origins. Adjust as needed for security.
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization'],
        }),
    );

    // Process graphlettes
    for (const graphlette of config.graphlettes) {
        await processGraphlette(graphlette, auth, app);
    }

    // Process restlettes
    for (const restlette of config.restlettes) {
        await processRestlette(restlette, auth, app, config.port);
    }

    return app;
}

export async function cleanServer() {
    console.log('Cleaning server');
    let count = 1;
    for (const client in clients) {
        console.log(`Closing client ${count}`);
        await clients[client].close();
        count++;
    }
    for (const pool in pools) {
        console.log(`Closing pg ${count}`);
        await pools[pool].end();
        count++;
    }
    for (const pool in mysqlPools) {
        console.log(`Closing mysql ${count}`);
        await mysqlPools[pool].end();
        count++;
    }
}
