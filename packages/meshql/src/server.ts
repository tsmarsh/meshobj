import express, { Application } from 'express';
import { DTOFactory, root, init as graph_init } from '@meshobj/graphlette';
import { init as rest_init } from '@meshobj/restlette';
import {
    Config,
    Graphlette,
    Restlette,
    StorageConfig,
} from './configTypes';
import { Repository, Searcher, Validator } from '@meshobj/common';
import { Pool } from 'pg';
import { MongoClient } from 'mongodb';
import { Crud } from '@meshobj/restlette';
import { JSONSchemaValidator } from '@meshobj/restlette';
import { JWTSubAuthorizer } from '@meshobj/jwt_auth';
import { Auth } from '@meshobj/auth';
import { CasbinAuth } from '@meshobj/casbin_auth';
import cors from 'cors';

// Import our new helper factories
import { MongoPlugin } from '@meshobj/mongo_repo';
import { SQLitePlugin } from '@meshobj/sqlite_repo';
import { PostgresPlugin } from '@meshobj/postgres_repo';
import { MySQLPlugin } from '@meshobj/mysql_repo';

import { Pool as MySQLPool } from 'mysql2/promise';
import { Plugin } from './plugin';
let pools: Record<string, Pool> = {};
let clients: Record<string, MongoClient> = {};
let mysqlPools: Record<string, MySQLPool> = {};

let plugins: Record<string, Plugin> = {
    mongo: new MongoPlugin(),
    sql: new SQLitePlugin(),
    postgres: new PostgresPlugin(),
    mysql: new MySQLPlugin(),
};

async function processGraphlette(graphlette: Graphlette, auth: Auth, app: Application) {
    const { schema, storage, path, rootConfig } = graphlette;

    const dtoFactory = new DTOFactory(rootConfig.resolvers);
    let searcher: Searcher;

    searcher = await plugins[storage.type].createSearcher(storage, dtoFactory, auth);

    const rt = root(searcher, dtoFactory, auth, rootConfig);
    graph_init(app, schema, path, rt);
}

async function buildRepository(storage: StorageConfig): Promise<Repository> {
    return plugins[storage.type].createRepository(storage);
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
