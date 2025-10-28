import { Before, After, AfterAll, setDefaultTimeout } from '@cucumber/cucumber';
import { TestWorld } from '@meshobj/common/test/support/world';
import { MySQLRepository } from '../../src/mysqlRepo';
import { MySQLSearcher } from '../../src/mysqlSearcher';
import { createPool, Pool } from 'mysql2/promise';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { compile } from 'handlebars';
import { DTOFactory } from '@meshobj/graphlette';
import { NoOp } from '@meshobj/auth';
import { randomUUID } from 'crypto';

setDefaultTimeout(60000);

let container: StartedTestContainer;
let pools: Pool[] = [];

Before(async function(this: TestWorld) {
    if (!container) {
        container = await new GenericContainer('mysql:8.0')
            .withEnvironment({
                MYSQL_ROOT_PASSWORD: 'root',
                MYSQL_DATABASE: 'test',
            })
            .withExposedPorts(3306)
            .start();
    }

    this.createRepository = async () => {
        const pool = createPool({
            host: container.getHost(),
            port: container.getMappedPort(3306),
            user: 'root',
            password: 'root',
            database: 'test',
            waitForConnections: true,
            connectionLimit: 10,
            maxIdle: 10,
            idleTimeout: 60000,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 0,
        });
        pools.push(pool);

        const tableName = `test_${randomUUID().replace(/-/g, '')}`;
        const repo = new MySQLRepository(pool, tableName);
        await repo.initialize();
        return repo;
    };

    this.createSearcher = async () => {
        const pool = createPool({
            host: container.getHost(),
            port: container.getMappedPort(3306),
            user: 'root',
            password: 'root',
            database: 'test',
            waitForConnections: true,
            connectionLimit: 10,
            maxIdle: 10,
            idleTimeout: 60000,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 0,
        });
        pools.push(pool);

        const tableName = `test_${randomUUID().replace(/-/g, '')}`;
        const repo = new MySQLRepository(pool, tableName);
        await repo.initialize();

        const dtoFactory = new DTOFactory([]);
        const auth = new NoOp();
        const searcher = new MySQLSearcher(pool, tableName, dtoFactory, auth);

        return { repository: repo, searcher };
    };

    this.tearDown = async () => {
        await Promise.all(pools.map(pool => pool.end()));
        pools = [];
    };

    // Templates for searcher tests - MySQL SQL syntax
    this.templates = {
        findById: compile(`id = '{{id}}'`),
        findByName: compile(`JSON_EXTRACT(payload, '$.name') = '{{id}}'`),
        findAllByType: compile(`JSON_EXTRACT(payload, '$.type') = '{{id}}'`),
        findByNameAndType: compile(`JSON_EXTRACT(payload, '$.type') = '{{type}}' AND JSON_EXTRACT(payload, '$.name') = '{{name}}'`),
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
