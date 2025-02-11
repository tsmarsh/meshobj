import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { ServerCertificiation } from '../../meshql/test/the_farm.cert';
import Log4js from 'log4js';
import { describe } from 'vitest';
import { MongoPlugin } from '../src';
import { config } from './config';
let mongod: MongoMemoryServer;
let uri: string;
let client: MongoClient;

Log4js.configure({
    appenders: {
        out: {
            type: 'stdout',
        },
    },
    categories: {
        default: { appenders: ['out'], level: 'error' },
    },
});

let setup = async () => {
    try {
        mongod = await MongoMemoryServer.create();
    } catch (err) {
        console.error(JSON.stringify(err));
    }

    uri = mongod.getUri();

    client = new MongoClient(uri);
    await client.connect();
};

let cleanup = async () => {
    if (client) await client.close();
    if (mongod) await mongod.stop();
};

describe('Mongo Farm', () => {
    ServerCertificiation(setup, {"mongo": new MongoPlugin()}, config);
});
