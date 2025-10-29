import { Before, After, AfterAll, BeforeAll, setDefaultTimeout } from '@cucumber/cucumber';
import { TestWorld } from '@meshobj/common/test/support/world';
import { FarmTestWorld } from '@meshobj/common/test/steps/farm_steps';
import { MongoRepository } from '../../src/mongoRepo';
import { MongoSearcher } from '../../src/mongoSearcher';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Collection, MongoClient } from 'mongodb';
import { Envelope } from '@meshobj/common';
import { compile } from 'handlebars';
import { DTOFactory } from '@meshobj/graphlette';
import { NoOp } from '@meshobj/auth';
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

interface MongoConfig extends StorageConfig {
    uri: string;
    db: string;
    collection: string;
    options?: any;
}

// MongoPlugin class defined inline
class MongoPlugin implements Plugin {
    private clients: MongoClient[] = [];

    async createRepository(config: StorageConfig) {
        const mongoConfig = config as MongoConfig;
        const client = new MongoClient(mongoConfig.uri, mongoConfig.options);
        await client.connect();
        this.clients.push(client);

        const db = client.db(mongoConfig.db);
        const collection: Collection<Envelope> = db.collection(mongoConfig.collection);
        return new MongoRepository(collection);
    }

    async createSearcher(config: StorageConfig, dtoFactory: DTOFactory, auth: Auth) {
        const mongoConfig = config as MongoConfig;
        const client = new MongoClient(mongoConfig.uri, mongoConfig.options);
        await client.connect();
        this.clients.push(client);

        const db = client.db(mongoConfig.db);
        const collection: Collection<Envelope> = db.collection(mongoConfig.collection);
        return new MongoSearcher(collection, dtoFactory, auth, client, mongoConfig.collection);
    }

    async cleanup() {
        await Promise.all(this.clients.map(client => client.close()));
        this.clients = [];
    }
}

setDefaultTimeout(60000);

let mongod: MongoMemoryServer;
let clients: MongoClient[] = [];
let globalFarmServer: any = null;

// Setup for farm tests
BeforeAll(async function() {
    // Start MongoDB Memory Server for farm tests
    if (!mongod) {
        mongod = await MongoMemoryServer.create();
    }

    const config = getFarmConfig();
    // Override URI to use memory server
    config.graphlettes.forEach((g: any) => g.storage.uri = mongod.getUri());
    config.restlettes.forEach((r: any) => r.storage.uri = mongod.getUri());

    const token = jwt.sign({ sub: 'test-user' }, 'totallyASecret', { expiresIn: '1h' });
    const plugin = new MongoPlugin();

    try {
        const app = await init(config, { mongo: plugin });
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
    if (!mongod) {
        mongod = await MongoMemoryServer.create();
    }

    // For repository/searcher tests
    this.createRepository = async () => {
        const client = new MongoClient(mongod.getUri());
        await client.connect();
        clients.push(client);

        const db = client.db('test');
        const collection: Collection<Envelope> = db.collection(crypto.randomUUID());

        return new MongoRepository(collection);
    };

    this.createSearcher = async () => {
        const client = new MongoClient(mongod.getUri());
        await client.connect();
        clients.push(client);

        const db = client.db('test');
        const collectionName = crypto.randomUUID();
        const collection: Collection<Envelope> = db.collection(collectionName);

        const repo = new MongoRepository(collection);
        const dtoFactory = new DTOFactory([]);
        const auth = new NoOp();
        const searcher = new MongoSearcher(collection, dtoFactory, auth, client, collectionName);

        return { repository: repo, searcher };
    };

    this.tearDown = async () => {
        await Promise.all(clients.map(client => client.close()));
        clients = [];
    };

    // Templates for searcher tests - MongoDB JSON query syntax
    this.templates = {
        findById: compile(`{"id": "{{id}}"}`),
        findByName: compile(`{"payload.name": "{{id}}"}`),
        findAllByType: compile(`{"payload.type": "{{id}}"}`),
        findByNameAndType: compile(`{"payload.name": "{{name}}", "payload.type": "{{type}}"}`),
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

    if (mongod) {
        await mongod.stop();
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
