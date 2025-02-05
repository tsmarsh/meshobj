import { Searcher, Envelope, Repository } from '@meshql/common';
import { SearcherCertification, TestTemplates } from '../../common/test/certification/searcher.cert';
import { DTOFactory } from '@meshql/graphlette';
import { NoOp, Auth } from '@meshql/auth';
import { compile } from 'handlebars';
import { Pool } from 'pg';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { PostgresRepository } from '../src/postgresRepo';
import { PostgresSearcher } from '../src/postgresSearcher';
import { describe } from 'vitest';

const dbs: Pool[] = [];
let container: StartedTestContainer | null = null;

const createSearcher = async (): Promise<{ repository: Repository; searcher: Searcher }> => {
    if (!container) {
        container = await new GenericContainer('postgres')
            .withExposedPorts(5432)
            .withEnvironment({
                POSTGRES_PASSWORD: 'password',
                POSTGRES_DB: 'test',
            })
            .start();
    }

    const pool = new Pool({
        user: 'postgres',
        host: container.getHost(),
        port: container.getMappedPort(5432),
        database: `test`,
        password: 'password',
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
