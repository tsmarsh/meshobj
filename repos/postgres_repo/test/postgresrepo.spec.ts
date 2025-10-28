import { Client, Pool } from 'pg';
import { PostgresRepository } from '../src/postgresRepo'; // Assuming the repository is in this file
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RepositoryCertification } from '../../packages/common/test/certification/repository.cert';
import { Environment } from 'testcontainers/build/types';
import { describe } from 'vitest';
import { SearcherCertification } from '../../packages/common/test/certification/searcher.cert';

let container: StartedPostgreSqlContainer | null = null;
let dbs: Pool[] = []; // To track active connections

let host;
let port;
let user = 'alice';
let password = 'face';
let db = 'repository';

const createRepository = async (): Promise<PostgresRepository> => {
    // Start a PostgreSQL container using TestContainers
    let env: Environment = {
        POSTGRES_PASSWORD: 'password',
        POSTGRES_DB: 'test',
    };
    if (!container) {
        container = await new PostgreSqlContainer("postgres:17-alpine3.21")
            .withUsername(user)
            .withPassword(password)
            .withDatabase(db)
            .start();
    }

    host = container.getHost();
    port = container.getMappedPort(5432);

    // Connect to the database
    const pool = new Pool({
        user,
        host,
        database: db,
        password,
        port,
    });

    dbs.push(pool);

    // Create the repository
    const repo = new PostgresRepository(pool, `test${dbs.length}`);

    await repo.initialize();

    return repo;
};

const tearDown = async (): Promise<void> => {
    await Promise.all(
        dbs.map((db) => {
            db.end();
        }),
    );
    if (container) {
        await container.stop();
    }
};

async function getPostgresTimestamp(): Promise<number> {
    const client = new Client({
        host,
        port,
        user,
        password,
        database: db,
    });

    try {
        await client.connect();
        const res = await client.query('SELECT NOW() as current_time');
        let date = res.rows[0].current_time as Date;
        return date.getTime();

    } finally {
        await client.end();
    }
}

describe('Postgres Repository', () => {
    RepositoryCertification(createRepository, tearDown, getPostgresTimestamp);
});

