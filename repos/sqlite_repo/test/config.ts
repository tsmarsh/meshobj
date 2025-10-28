import { Config } from '@meshobj/server';
import { SQLConfig } from '../src';
import fs from 'fs';

const PORT = 5255;

const PLATFORM_URL = `http://localhost:${PORT}`;
const PREFIX = 'farm';
const ENV = 'test';

const config_dir = `${__dirname}/../../../packages/server/test/config/`;

const database = {
    type: 'sql',
    uri: './thefarm.db',
};

const henDB = (): SQLConfig => ({
    ...database,
    collection: `${PREFIX}_${ENV}hen`,
});

const coopDB = (): SQLConfig => ({
    ...database,
    collection: `${PREFIX}_${ENV}coop`,
});

const farmDB = (): SQLConfig => ({
    ...database,
    collection: `${PREFIX}_${ENV}farm`,
});

const farmSchema = fs.readFileSync(`${config_dir}graph/farm.graphql`, 'utf8');
const coopSchema = fs.readFileSync(`${config_dir}graph/coop.graphql`, 'utf8');
const henSchema = fs.readFileSync(`${config_dir}graph/hen.graphql`, 'utf8');

const farmJSONSchema = JSON.parse(fs.readFileSync(`${config_dir}json/farm.schema.json`, 'utf8'));
const coopJSONSchema = JSON.parse(fs.readFileSync(`${config_dir}json/coop.schema.json`, 'utf8'));
const henJSONSchema = JSON.parse(fs.readFileSync(`${config_dir}json/hen.schema.json`, 'utf8'));

export const config = async (): Promise<Config> => {
    return {
        port: PORT,

        graphlettes: [
            {
                path: '/farm/graph',
                storage: farmDB(),
                schema: farmSchema,
                rootConfig: {
                    singletons: [
                        {
                            name: 'getById',
                            query: "id = '{{id}}'",
                        },
                    ],
                    vectors: [],
                    resolvers: [
                        {
                            name: 'coops',
                            queryName: 'getByFarm',
                            url: `${PLATFORM_URL}/coop/graph`,
                        },
                    ],
                },
            },
            {
                path: '/coop/graph',
                storage: coopDB(),
                schema: coopSchema,
                rootConfig: {
                    singletons: [
                        {
                            name: 'getByName',
                            id: 'name',
                            query: "json_extract(payload, '$.name') = '{{id}}'",
                        },
                        {
                            name: 'getById',
                            query: "id = '{{id}}'",
                        },
                    ],
                    vectors: [
                        {
                            name: 'getByFarm',
                            query: "json_extract(payload, '$.farm_id') = '{{id}}'",
                        },
                    ],
                    resolvers: [
                        {
                            name: 'farm',
                            id: 'farm_id',
                            queryName: 'getById',
                            url: `${PLATFORM_URL}/farm/graph`,
                        },
                        {
                            name: 'hens',
                            queryName: 'getByCoop',
                            url: `${PLATFORM_URL}/hen/graph`,
                        },
                    ],
                },
            },
            {
                path: '/hen/graph',
                storage: henDB(),
                schema: henSchema,
                rootConfig: {
                    singletons: [
                        {
                            name: 'getById',
                            query: "id = '{{id}}'",
                        },
                    ],
                    vectors: [
                        {
                            name: 'getByName',
                            query: "json_extract(payload, '$.name') = '{{name}}'",
                        },
                        {
                            name: 'getByCoop',
                            query: "json_extract(payload, '$.coop_id') = '{{id}}'",
                        },
                    ],
                    resolvers: [
                        {
                            name: 'coop',
                            id: 'coop_id',
                            queryName: 'getById',
                            url: `${PLATFORM_URL}/coop/graph`,
                        },
                    ],
                },
            },
        ],

        restlettes: [
            {
                path: '/farm/api',
                storage: farmDB(),
                schema: farmJSONSchema,
            },
            {
                path: '/coop/api',
                storage: coopDB(),
                schema: coopJSONSchema,
            },
            {
                path: '/hen/api',
                storage: henDB(),
                schema: henJSONSchema,
            },
        ],
    };
};
