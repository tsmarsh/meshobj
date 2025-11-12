import { Config, StorageConfig } from '@meshobj/server';
import { MongoConfig } from '../../src';
import fs from 'fs';
const PORT = 3044;
const ENV = 'test';
const PREFIX = 'farm';
const PLATFORM_URL = `http://localhost:${PORT}`;
const config_dir = `${__dirname}/../../../core/server/test/config/`;

const database = () => ({
    type: 'mongo',
    uri: process.env.MONGO_URI || 'mongodb://localhost:27017',
    db: `${PREFIX}_${ENV}`,
    options: {
        directConnection: true,
    },
});

const henDB = (config: MongoConfig): MongoConfig => {
    config.collection = `${PREFIX}-${ENV}-hen`;
    return config;
};
const coopDB = (config: MongoConfig): MongoConfig => {
    config.collection = `${PREFIX}-${ENV}-coop`;
    return config;
};
const farmDB = (config: MongoConfig): MongoConfig => {
    config.collection = `${PREFIX}-${ENV}-farm`;
    return config;
};
