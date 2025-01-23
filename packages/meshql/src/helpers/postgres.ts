import { Pool } from "pg";
import { PostgresConfig } from "../configTypes";
import { PostgresSearcher, PostgresRepository } from "@meshql/postgres_repo";
import { DTOFactory } from "@meshql/graphlette";
import { Auth } from "@meshql/auth";
import { Repository } from "@meshql/common";

/**
 * Creates and returns a Postgres Pool connection.
 */
export function buildPostgresPool(config: PostgresConfig): Pool {
    console.log("Building Postgres Pool with config:", config);
    return new Pool({
        host: config.host,
        port: config.port,
        database: config.db,
        user: config.user,
        password: config.password,
    });
}

/**
 * Creates a PostgresSearcher with the given config, DTOFactory, and auth.
 */
export function createPostgresSearcher(pgConfig: PostgresConfig, dtoFactory: DTOFactory, auth: Auth): PostgresSearcher {
    const pool = buildPostgresPool(pgConfig);
    return new PostgresSearcher(pool, pgConfig.table, dtoFactory, auth);
}

/**
 * Creates a PostgresRepository with the given config.
 */
export async function createPostgresRepository(pgConfig: PostgresConfig): Promise<Repository> {
    const pool = buildPostgresPool(pgConfig);
    const repo = new PostgresRepository(pool, pgConfig.table);
    await repo.initialize();
    return repo;
}
