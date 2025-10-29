import { Before, After, AfterAll, BeforeAll, setDefaultTimeout } from '@cucumber/cucumber';
import { TestWorld } from '@meshobj/common/test/support/world';
import { FarmTestWorld } from '@meshobj/common/test/steps/farm_steps';
import { MySQLRepository } from '../../src/mysqlRepo';
import { MySQLSearcher } from '../../src/mysqlSearcher';
import { createPool, Pool } from 'mysql2/promise';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { compile } from 'handlebars';
import { DTOFactory } from '@meshobj/graphlette';
import { NoOp } from '@meshobj/auth';
import { randomUUID } from 'crypto';
import { init, Plugin, StorageConfig } from '@meshobj/server';
import { Document, OpenAPIClient, OpenAPIClientAxios } from 'openapi-client-axios';
import { Auth } from '@meshobj/auth';
import * as jwt from 'jsonwebtoken';
import { config as getFarmConfig } from '../config';
import Log4js from 'log4js';

Log4js.configure({
    appenders: { out: { type: 'stdout' } },
    categories: { default: { appenders: ['out'], level: 'error' } },
});

interface MySQLConfig extends StorageConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    collection: string;
}

// MySQLPlugin class defined inline
class MySQLPlugin implements Plugin {
    private pools: Pool[] = [];

    async createRepository(config: StorageConfig) {
        const mysqlConfig = config as MySQLConfig;
        const pool = createPool({
            host: mysqlConfig.host,
            port: mysqlConfig.port,
            user: mysqlConfig.user,
            password: mysqlConfig.password,
            database: mysqlConfig.database,
            waitForConnections: true,
            connectionLimit: 10,
        });
        this.pools.push(pool);

        const repo = new MySQLRepository(pool, mysqlConfig.collection);
        await repo.initialize();
        return repo;
    }

    async createSearcher(config: StorageConfig, dtoFactory: DTOFactory, auth: Auth) {
        const mysqlConfig = config as MySQLConfig;
        const pool = createPool({
            host: mysqlConfig.host,
            port: mysqlConfig.port,
            user: mysqlConfig.user,
            password: mysqlConfig.password,
            database: mysqlConfig.database,
            waitForConnections: true,
            connectionLimit: 10,
        });
        this.pools.push(pool);

        return new MySQLSearcher(pool, mysqlConfig.collection, dtoFactory, auth);
    }

    async cleanup() {
        await Promise.all(this.pools.map(pool => pool.end()));
        this.pools = [];
    }
}

setDefaultTimeout(60000);

let container: StartedTestContainer;
let pools: Pool[] = [];
let globalFarmServer: any = null;

// Setup for farm tests
BeforeAll(async function() {
    // Start MySQL container for farm tests
    if (!container) {
        container = await new GenericContainer('mysql:8.0')
            .withEnvironment({
                MYSQL_ROOT_PASSWORD: 'root',
                MYSQL_DATABASE: 'test',
            })
            .withExposedPorts(3306)
            .start();
    }

    const config = getFarmConfig();
    // Override connection settings to use test container
    const mysqlSettings = {
        host: container.getHost(),
        port: container.getMappedPort(3306),
        user: 'root',
        password: 'root',
        database: 'test',
    };
    config.graphlettes.forEach((g: any) => Object.assign(g.storage, mysqlSettings));
    config.restlettes.forEach((r: any) => Object.assign(r.storage, mysqlSettings));

    const token = jwt.sign({ sub: 'test-user' }, 'totallyASecret', { expiresIn: '1h' });
    const plugin = new MySQLPlugin();

    try {
        const app = await init(config, { mysql: plugin });
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

Before(async function(this: TestWorld & FarmTestWorld) {
    if (!container) {
        container = await new GenericContainer('mysql:8.0')
            .withEnvironment({
                MYSQL_ROOT_PASSWORD: 'root',
                MYSQL_DATABASE: 'test',
            })
            .withExposedPorts(3306)
            .start();
    }

    // For repository/searcher tests
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

AfterAll(async () => {
    if (globalFarmServer) {
        await globalFarmServer.plugin.cleanup();
        if (globalFarmServer.server) {
            globalFarmServer.server.close();
        }
        globalFarmServer = null;
    }

    if (container) {
        await container.stop();
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
