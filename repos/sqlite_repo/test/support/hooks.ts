import { Before, After, AfterAll, BeforeAll, setDefaultTimeout } from '@cucumber/cucumber';
import { FarmTestWorld } from 'core/common/test/support/worlds';
import { SQLiteRepository } from '../../src/sqliteRepo';
import { SQLiteSearcher } from '../../src/sqliteSearcher';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { compile } from 'handlebars';
import { DTOFactory } from '@meshobj/graphlette';
import { NoOp } from '@meshobj/auth';
import { init, Plugin } from '@meshobj/server';
import * as jwt from 'jsonwebtoken';
import { config as getFarmConfig } from '../config';
import { StorageConfig } from '@meshobj/server';
import { Auth } from '@meshobj/auth';
import Log4js from 'log4js';
import { SQLConfig } from '../../src';

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

        globalFarmServer = {
            app,
            server,
            config,
            token,
            plugin,
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

Before(async function(this: IntegrationWorld & FarmTestWorld) {
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
        this.coop_ids = globalFarmServer.coop_ids;
        this.hen_ids = globalFarmServer.hen_ids;
        this.first_stamp = globalFarmServer.first_stamp;
    }
});

After(async function(this: TestWorld) {
    if (this.tearDown) {
        await this.tearDown();
    }
});
