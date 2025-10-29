import { Before, After, AfterAll, BeforeAll, setDefaultTimeout } from '@cucumber/cucumber';
import { TestWorld } from '@meshobj/common/test/support/world';
import { FarmTestWorld } from '@meshobj/common/test/steps/farm_steps';
import { SQLiteRepository } from '../../src/sqliteRepo';
import { SQLiteSearcher } from '../../src/sqliteSearcher';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { compile } from 'handlebars';
import { DTOFactory } from '@meshobj/graphlette';
import { NoOp } from '@meshobj/auth';
import { init, Plugin } from '@meshobj/server';
import { Document, OpenAPIClient, OpenAPIClientAxios } from 'openapi-client-axios';
import * as jwt from 'jsonwebtoken';
import { config as getFarmConfig } from '../config';
import { StorageConfig } from '@meshobj/server';
import { Auth } from '@meshobj/auth';
import Log4js from 'log4js';

interface SQLConfig extends StorageConfig {
    uri: string;
    collection: string;
}

// SQLitePlugin class defined inline to avoid import issues with .js extensions
class SQLitePlugin implements Plugin {
    async createRepository(config: StorageConfig) {
        const sqlConfig = config as SQLConfig;
        const db = await open({
            filename: sqlConfig.uri,
            driver: sqlite3.Database,
        });
        const repo = new SQLiteRepository(db, sqlConfig.collection);
        await repo.initialize();
        return repo;
    }

    async createSearcher(config: StorageConfig, dtoFactory: DTOFactory, auth: Auth) {
        const sqlConfig = config as SQLConfig;
        const db = await open({
            filename: sqlConfig.uri,
            driver: sqlite3.Database,
        });
        return new SQLiteSearcher(db, sqlConfig.collection, dtoFactory, auth);
    }

    async cleanup() {
        // SQLite does not require explicit cleanup
    }
}

Log4js.configure({
    appenders: { out: { type: 'stdout' } },
    categories: { default: { appenders: ['out'], level: 'error' } },
});

setDefaultTimeout(60000);

let dbs: Database[] = [];
let globalFarmServer: any = null;

// Setup for farm tests
BeforeAll(async function() {
    const config = await getFarmConfig();
    const token = jwt.sign({ sub: 'test-user' }, 'totallyASecret', { expiresIn: '1h' });
    const plugin = new SQLitePlugin();

    try {
        const app = await init(config, { sql: plugin });
        const server = await app.listen(config.port);

        // Build API clients and populate data
        const swagger_docs: Document[] = await getSwaggerDocs(config);
        const apis = await buildApis(swagger_docs, token);
        const { farm_id, coop1_id, coop2_id, hen_ids, first_stamp } = await buildModels(apis);

        globalFarmServer = {
            app,
            server,
            config,
            token,
            plugin,
            farm_id,
            coop1_id,
            coop2_id,
            hen_ids,
            first_stamp,
        };
    } catch (e) {
        console.error('Failed to setup farm server:', e);
        throw e;
    }
});

AfterAll(async function() {
    if (globalFarmServer) {
        await globalFarmServer.plugin.cleanup();
        if (globalFarmServer.server) {
            globalFarmServer.server.close();
        }

        // Cleanup database file
        const fs = require('fs');
        try {
            fs.unlinkSync('./thefarm.db');
        } catch (err) {
            // Ignore errors if file doesn't exist
        }

        globalFarmServer = null;
    }
});

Before(async function(this: TestWorld & FarmTestWorld) {
    // For repository/searcher tests
    this.createRepository = async () => {
        const db = await open({
            filename: ':memory:',
            driver: sqlite3.Database,
        });
        dbs.push(db);

        const repo = new SQLiteRepository(db, `test_${Date.now()}_${Math.floor(Math.random() * 1000000)}`);
        await repo.initialize();
        return repo;
    };

    this.createSearcher = async () => {
        const db = await open({
            filename: ':memory:',
            driver: sqlite3.Database,
        });
        dbs.push(db);

        const tableName = `test_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
        const repo = new SQLiteRepository(db, tableName);
        await repo.initialize();

        const dtoFactory = new DTOFactory([]);
        const auth = new NoOp();
        const searcher = new SQLiteSearcher(db, tableName, dtoFactory, auth);

        return { repository: repo, searcher };
    };

    this.tearDown = async () => {
        await Promise.all(dbs.map(db => db.close()));
        dbs = [];
    };

    // Templates for searcher tests - SQLite syntax
    this.templates = {
        findById: compile(`id = '{{id}}'`),
        findByName: compile(`json_extract(payload, '$.name') = '{{id}}'`),
        findAllByType: compile(`json_extract(payload, '$.type') = '{{id}}'`),
        findByNameAndType: compile(`json_extract(payload, '$.type') = '{{type}}' AND json_extract(payload, '$.name') = '{{name}}'`),
    };

    // For farm tests - share global server state
    if (globalFarmServer) {
        this.app = globalFarmServer.app;
        this.server = globalFarmServer.server;
        this.config = globalFarmServer.config;
        this.token = globalFarmServer.token;
        this.farm_id = globalFarmServer.farm_id;
        this.coop1_id = globalFarmServer.coop1_id;
        this.coop2_id = globalFarmServer.coop2_id;
        this.hen_ids = globalFarmServer.hen_ids;
        this.first_stamp = globalFarmServer.first_stamp;
    }
});

After(async function(this: TestWorld) {
    if (this.tearDown) {
        await this.tearDown();
    }
});

// Helper functions for farm setup
async function getSwaggerDocs(config: any): Promise<Document[]> {
    return await Promise.all(
        config.restlettes.map(async (restlette: any) => {
            const url = `http://localhost:${config.port}${restlette.path}/api-docs/swagger.json`;
            const response = await fetch(url);
            return await response.json();
        }),
    );
}

async function buildApis(swagger_docs: Document[], token: string) {
    const authHeaders = { Authorization: `Bearer ${token}` };
    const apis: OpenAPIClient[] = await Promise.all(
        swagger_docs.map(async (doc: Document) => {
            const api = new OpenAPIClientAxios({
                definition: doc,
                axiosConfigDefaults: { headers: authHeaders },
            });
            return api.init();
        }),
    );

    let hen_api, coop_api, farm_api;
    for (const api of apis) {
        const firstPath = Object.keys(api.paths)[0];
        if (firstPath.includes('hen')) hen_api = api;
        else if (firstPath.includes('coop')) coop_api = api;
        else if (firstPath.includes('farm')) farm_api = api;
    }

    return { hen_api, coop_api, farm_api };
}

async function buildModels(apis: any) {
    const { hen_api, coop_api, farm_api } = apis;

    const farm = await farm_api.create(null, { name: 'Emerdale' });
    const farm_id = farm.request.path.slice(-36);

    const coop1 = await coop_api.create(null, { name: 'red', farm_id });
    const coop1_id = coop1.request.path.slice(-36);

    const coop2 = await coop_api.create(null, { name: 'yellow', farm_id });
    const coop2_id = coop2.request.path.slice(-36);

    await coop_api.create(null, { name: 'pink', farm_id });

    const first_stamp = Date.now();

    await coop_api.update({ id: coop1_id }, { name: 'purple', farm_id });

    const hens = [
        { name: 'chuck', eggs: 2, coop_id: coop1_id },
        { name: 'duck', eggs: 0, coop_id: coop1_id },
        { name: 'euck', eggs: 1, coop_id: coop2_id },
        { name: 'fuck', eggs: 2, coop_id: coop2_id },
    ];

    const savedHens = await Promise.all(hens.map((hen) => hen_api.create(null, hen)));

    const hen_ids: Record<string, string> = {};
    savedHens.forEach((hen: any) => {
        hen_ids[hen.data.name] = hen.headers['x-canonical-id'];
    });

    return { farm_id, coop1_id, coop2_id, hen_ids, first_stamp };
}
