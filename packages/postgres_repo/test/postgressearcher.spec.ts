import { Searcher, Envelope, Repository } from "@meshql/common";
import { SearcherCertification, TestTemplates } from "../../common/test/certification/searcher.cert";
import { DTOFactory } from "@meshql/graphlette";
import { NoOp, Auth } from "@meshql/auth";
import { compile } from "handlebars";
import { Pool } from "pg";
import { GenericContainer, StartedTestContainer } from "testcontainers";
import { PostgresRepository } from "../src/postgresRepo";
import { PostgresSearcher } from "../src/postgresSearcher";

const dbs: Pool[] = [];
let container: StartedTestContainer | null = null;

const createSearcher = async (data: Envelope[]): Promise<{ repository: Repository, searcher: Searcher }> => {
    if (!container) {
        container = await new GenericContainer("postgres")
            .withExposedPorts(5432)
            .withEnvironment({
                "POSTGRES_PASSWORD":"password",
                "POSTGRES_DB":"test"
            })
            .start();
    }

    const pool = new Pool({
        user: "postgres",
        host: container.getHost(),
        port: container.getMappedPort(5432),
        database: `test`,
        password: "password"
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

const findById = `
            SELECT *
            FROM {{_name}}
            WHERE id = '{{id}}'
              AND created_at <= '{{_createdAt}}'
            ORDER BY created_at DESC
            LIMIT 1`;

const findByName = `
            SELECT *
            FROM {{_name}}
            WHERE payload->>'name' = '{{id}}'
              AND created_at <= '{{_createdAt}}'
            ORDER BY created_at DESC
            LIMIT 1`;

const findAllByType = `
            SELECT DISTINCT ON (id) *
            FROM {{_name}}
            WHERE payload->>'type' = '{{id}}'
              AND created_at <= '{{_createdAt}}'
            ORDER BY id, created_at DESC`;

const findByNameAndType = `
            SELECT DISTINCT ON (id) *
            FROM {{_name}}
            WHERE payload->>'type' = '{{type}}'
              AND payload->>'name' = '{{name}}'
              AND created_at <= '{{_createdAt}}'
            ORDER BY id, created_at DESC`;

const templates: TestTemplates = {
    findById: compile(findById),
    findByName: compile(findByName),
    findAllByType: compile(findAllByType),
    findByNameAndType: compile(findByNameAndType),
};

SearcherCertification(createSearcher, tearDown, templates);