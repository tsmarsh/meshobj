import { Before, After, AfterAll, BeforeAll, setDefaultTimeout } from '@cucumber/cucumber';
import { TestWorld } from 'core/common/test/support/worlds';
import { FarmTestWorld } from '@meshobj/common/test/steps/farm_steps';
import { PostgresRepository } from '../../src/postgresRepo';
import { PostgresSearcher } from '../../src/postgresSearcher';
import { Pool } from 'pg';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { compile } from 'handlebars';
import { DTOFactory } from '@meshobj/graphlette';
import { NoOp } from '@meshobj/auth';
import { init, Plugin, StorageConfig } from '@meshobj/server';
import { Auth } from '@meshobj/auth';
import * as jwt from 'jsonwebtoken';
import { config as getFarmConfig } from '../config';
import Log4js from 'log4js';
import { PostgresConfig, PostgresPlugin } from '../../src';

Log4js.configure({
    appenders: { out: { type: 'stdout' } },
    categories: { default: { appenders: ['out'], level: 'error' } },
});

setDefaultTimeout(60000);

let container: StartedPostgreSqlContainer | null = null;
let pool: Pool;
let tableCounter = 0;
let server;
let user = 'bob';
let password = 'max';
let database = 'test';


// Setup for farm tests
BeforeAll(async function() {
    // Start Postgres container for farm tests

    if (!container) {
        container = await new PostgreSqlContainer("postgres:17-alpine3.21")
            .withUsername(user)
            .withPassword(password)
            .withDatabase(database)
            .start();
    }

    const token = jwt.sign({ sub: 'test-user' }, 'totallyASecret', { expiresIn: '1h' });
    const plugin = new PostgresPlugin();

    try {
        const app = await init(config, { postgres: plugin });
        server = app.listen(config.port);

        // Build API clients and populate data
    } catch (e) {
        console.error('Failed to setup farm server:', e);
        throw e;
    }
});

Before(async function(this: TestWorld & FarmTestWorld) {
    const tableName = `test_${Date.now()}_${++tableCounter}`;

    // For repository/searcher tests
    this.createRepository = async () => {
        const repo = new PostgresRepository(pool, tableName);
        await repo.initialize();
        return repo;
    };

    this.createSearcher = async () => {
        const repo = new PostgresRepository(pool, tableName);
        await repo.initialize();

        const dtoFactory = new DTOFactory([]);
        const auth = new NoOp();
        const searcher = new PostgresSearcher(pool, tableName, dtoFactory, auth);

        return { repository: repo, searcher };
    };

    this.tearDown = async () => {
    };

    // Templates for searcher tests - Postgres SQL syntax
    this.templates = {
        findById: compile(`id = '{{id}}'`),
        findByName: compile(`payload->>'name' = '{{id}}'`),
        findAllByType: compile(`payload->>'type' = '{{id}}'`),
        findByNameAndType: compile(`payload->>'type' = '{{type}}' AND payload->>'name' = '{{name}}'`),
    };
});

After(async function(this: TestWorld) {
    if (this.tearDown) {
        await this.tearDown();
    }
});

AfterAll(async () => {
    await pool.end();

    if (container) {
        await container.stop();
    }
});