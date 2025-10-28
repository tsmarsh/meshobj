import { Before, After, AfterAll, setDefaultTimeout } from '@cucumber/cucumber';
import { TestWorld } from '@meshobj/common/test/support/world';
import { MongoRepository } from '../../src/mongoRepo';
import { MongoSearcher } from '../../src/mongoSearcher';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Collection, MongoClient } from 'mongodb';
import { Envelope } from '@meshobj/common';
import { compile } from 'handlebars';
import { DTOFactory } from '@meshobj/graphlette';
import { NoOp } from '@meshobj/auth';

setDefaultTimeout(60000);

let mongod: MongoMemoryServer;
let clients: MongoClient[] = [];

Before(async function(this: TestWorld) {
    if (!mongod) {
        mongod = await MongoMemoryServer.create();
    }

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
});

After(async function(this: TestWorld) {
    if (this.tearDown) {
        await this.tearDown();
    }
});

AfterAll(async () => {
    if (mongod) {
        await mongod.stop();
    }
});
