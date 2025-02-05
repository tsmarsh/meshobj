import { Searcher, Envelope, Repository } from '@meshql/common';
import { SearcherCertification, TestTemplates } from '../../common/test/certification/searcher.cert';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoRepository } from '../src/mongoRepo';
import { Collection, MongoClient } from 'mongodb';
import { MongoSearcher } from '../src/mongoSearcher';
import { DTOFactory } from '@meshql/graphlette';
import { NoOp, Auth } from '@meshql/auth';
import { compile } from 'handlebars';

let mongod: MongoMemoryServer;
const mongos: MongoClient[] = [];

const createSearcher = async (data: Envelope[]): Promise<{ repository: Repository; searcher: Searcher }> => {
    if (!mongod) {
        mongod = await MongoMemoryServer.create();
    }

    let client: MongoClient = new MongoClient(mongod.getUri());
    await client.connect();
    mongos.push(client);
    let db = client.db('test');
    let collection: Collection<Envelope> = db.collection(crypto.randomUUID());

    let dtoFactory = new DTOFactory([]);
    let auth: Auth = new NoOp();

    let repo = new MongoRepository(collection);

    return { repository: repo, searcher: new MongoSearcher(collection, dtoFactory, auth) };
};

const tearDown = async (): Promise<void> => {
    await Promise.all(
        mongos.map((client) => {
            client.close();
        }),
    );
    mongod.stop();
};

const findById = `{"id": "{{id}}"}`;
const findByName = `{"payload.name": "{{id}}"}`;
const findAllByType = `{"payload.type": "{{id}}"}`;
const findByNameAndType = `{"payload.name": "{{name}}", "payload.type": "{{type}}"}`;

const templates: TestTemplates = {
    findById: compile(findById),
    findByName: compile(findByName),
    findAllByType: compile(findAllByType),
    findByNameAndType: compile(findByNameAndType),
};

SearcherCertification(createSearcher, tearDown, templates);
