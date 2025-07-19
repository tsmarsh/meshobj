import { Pool } from 'pg';
import { PostgresRepository } from '../src/postgresRepo'; // Assuming the repository is in this file
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RepositoryCertification } from '../../common/test/certification/repository.cert';
import { Environment } from 'testcontainers/build/types';
import { describe } from 'vitest';
import { SearcherCertification } from '../../common/test/certification/searcher.cert';

let container: StartedPostgreSqlContainer | null = null;
let dbs: Pool[] = []; // To track active connections

const createRepository = async (): Promise<PostgresRepository> => {
    // Start a PostgreSQL container using TestContainers
    let env: Environment = {
        POSTGRES_PASSWORD: 'password',
        POSTGRES_DB: 'test',
    };
    if (!container) {
        container = await new PostgreSqlContainer("postgres:17-alpine3.21")
            .withUsername('alice')
            .withPassword('face')
            .withDatabase('repository')
            .start();
    }

    const host = container.getHost();
    const port = container.getMappedPort(5432);

    // Connect to the database
    const pool = new Pool({
        user: 'alice',
        host,
        database: 'repository',
        password: 'face',
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

describe('Postgres Repository', () => {
    RepositoryCertification(createRepository, tearDown);
});

