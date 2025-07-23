import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import Log4js from 'log4js';
import { ServerCertificiation } from '../../server/test/the_farm.cert';
import { describe } from 'vitest';
import { PostgresPlugin } from '../src';
import { config } from './config';
import { Client } from 'pg';

let container: StartedPostgreSqlContainer | null = null;
let serverPort: string = '4242';

let host;
let port;
let user = 'postgres';
let password ='password';
let db= 'test';

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

const setup = async () => {
    try {
        container = await new PostgreSqlContainer("postgres:17-alpine3.21")
            .withUsername(user)
            .withPassword(password)
            .withDatabase(db)
            .start();

        host = container.getHost();
        port = container.getMappedPort(5432);

        // Set (or overwrite) any environment variables needed by your application.
        process.env.POSTGRES_HOST = host;
        process.env.POSTGRES_PORT = port.toString();
        process.env.POSTGRES_DB = db;
        process.env.POSTGRES_USER = user;
        process.env.POSTGRES_PASSWORD = password;

        // Other environment variables you might need for your application
        process.env.ENV = 'test';
        process.env.PORT = serverPort;
        process.env.PREFIX = 'farm';
        process.env.PLATFORM_URL = `http://localhost:${serverPort}`;
    } catch (err) {
        console.error(JSON.stringify(err));
    }
};

const cleanup = async () => {
    if (container) {
        await container.stop({ timeout: 10000 });
    }
};

const configPath = `${__dirname}/config/config.conf`;

async function getPostgresTimestamp(): Promise<number> {
    let config = {
        host,
        port,
        user,
        password,
        database: db,
    };

    const client = new Client(config);

    try {
        await client.connect();
        const res = await client.query('SELECT NOW() as current_time');
        let date = res.rows[0].current_time as Date;
        return date.getTime();

    } finally {
        await client.end();
    }
}

describe('The Postgres Farm', async () => {
    ServerCertificiation(setup, { postgres: new PostgresPlugin() }, config, cleanup, getPostgresTimestamp)
});
