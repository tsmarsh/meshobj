import { Searcher, Repository } from '@meshobj/common';
import { SearcherCertification, TestTemplates } from '../../common/test/certification/searcher.cert';
import { DTOFactory } from '@meshobj/graphlette';
import { NoOp, Auth } from '@meshobj/auth';
import { compile } from 'handlebars';
import { Pool } from 'pg';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PostgresRepository } from '../src/postgresRepo';
import { PostgresSearcher } from '../src/postgresSearcher';
import { describe } from 'vitest';

const dbs: Pool[] = [];
let container: StartedPostgreSqlContainer | null = null;

const createSearcher = async (): Promise<{ repository: Repository; searcher: Searcher }> => {
    if (!container) {
        container = await new PostgreSqlContainer()
            .withUsername('bob')
            .withPassword('max')
            .withDatabase('searcher')
            .start();
    }

    const pool = new Pool({
        user: 'bob',
        host: container.getHost(),
        port: container.getMappedPort(5432),
        database: `searcher`,
        password: 'max',
    });

    dbs.push(pool);

    const repo = new PostgresRepository(pool, `test${dbs.length}`);

    await repo.initialize();

    const dtoFactory = new DTOFactory([]);
    const auth: Auth = new NoOp();

    return { repository: repo, searcher: new PostgresSearcher(pool, `test${dbs.length}`, dtoFactory, auth) };
};

const tearDown = async (): Promise<void> => {
    await Promise.all(dbs.map((db) => db.end()));
    if (container) {
        await container.stop();
    }
};

const findById = `id = '{{id}}'`;

const findByName = `payload->>'name' = '{{id}}'`;

const findAllByType = `payload->>'type' = '{{id}}'`;

const findByNameAndType = `payload->>'type' = '{{type}}' AND payload->>'name' = '{{name}}'`;

const templates: TestTemplates = {
    findById: compile(findById),
    findByName: compile(findByName),
    findAllByType: compile(findAllByType),
    findByNameAndType: compile(findByNameAndType),
};

describe('Postgres Searcher', () => {
    SearcherCertification(createSearcher, tearDown, templates);
});
