import { Before, After, AfterAll, setDefaultTimeout } from '@cucumber/cucumber';
import { TestWorld } from '@meshobj/common/test/support/world';
import { PostgresRepository } from '../../src/postgresRepo';
import { PostgresSearcher } from '../../src/postgresSearcher';
import { Pool } from 'pg';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { compile } from 'handlebars';
import { DTOFactory } from '@meshobj/graphlette';
import { NoOp } from '@meshobj/auth';

setDefaultTimeout(60000);

let container: StartedPostgreSqlContainer | null = null;
let pools: Pool[] = [];
let tableCounter = 0;

Before(async function(this: TestWorld) {
    if (!container) {
        container = await new PostgreSqlContainer("postgres:17-alpine3.21")
            .withUsername('bob')
            .withPassword('max')
            .withDatabase('test')
            .start();
    }

    this.createRepository = async () => {
        const pool = new Pool({
            user: 'bob',
            host: container!.getHost(),
            port: container!.getMappedPort(5432),
            database: 'test',
            password: 'max',
        });
        pools.push(pool);

        const tableName = `test_${Date.now()}_${++tableCounter}`;
        const repo = new PostgresRepository(pool, tableName);
        await repo.initialize();
        return repo;
    };

    this.createSearcher = async () => {
        const pool = new Pool({
            user: 'bob',
            host: container!.getHost(),
            port: container!.getMappedPort(5432),
            database: 'test',
            password: 'max',
        });
        pools.push(pool);

        const tableName = `test_${Date.now()}_${++tableCounter}`;
        const repo = new PostgresRepository(pool, tableName);
        await repo.initialize();

        const dtoFactory = new DTOFactory([]);
        const auth = new NoOp();
        const searcher = new PostgresSearcher(pool, tableName, dtoFactory, auth);

        return { repository: repo, searcher };
    };

    this.tearDown = async () => {
        await Promise.all(pools.map(pool => pool.end()));
        pools = [];
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
    if (container) {
        await container.stop();
    }
});
