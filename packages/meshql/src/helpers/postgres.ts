import { Pool, PoolConfig } from 'pg';
import { PostgresConfig } from '../configTypes';
import { PostgresSearcher, PostgresRepository } from '@meshobj/postgres_repo';
import { DTOFactory } from '@meshobj/graphlette';
import { Auth } from '@meshobj/auth';
import { Repository } from '@meshobj/common';

/**
 * Creates and returns a Postgres Pool connection.
 */
export function buildPostgresPool(config: PostgresConfig, pools: Record<string, Pool>): Pool {
    let pgConf: PoolConfig = {
        host: config.host,
        port: config.port,
        database: config.db,
        user: config.user,
        password: config.password,
    };
    let key = `${pgConf.host}:${pgConf.port}:${pgConf.database}:${pgConf.user}:${pgConf.password}`;

    if (!pools[key]) {
        pools[key] = new Pool(pgConf);
    }
    return pools[key];
}

/**
 * Creates a PostgresSearcher with the given config, DTOFactory, and auth.
 */
export function createPostgresSearcher(
    pgConfig: PostgresConfig,
    dtoFactory: DTOFactory,
    auth: Auth,
    pools: Record<string, Pool>,
): PostgresSearcher {
    const pool = buildPostgresPool(pgConfig, pools);
    return new PostgresSearcher(pool, pgConfig.table, dtoFactory, auth);
}

/**
 * Creates a PostgresRepository with the given config.
 */
export async function createPostgresRepository(
    pgConfig: PostgresConfig,
    pools: Record<string, Pool>,
): Promise<Repository> {
    const pool = buildPostgresPool(pgConfig, pools);
    const repo = new PostgresRepository(pool, pgConfig.table);
    await repo.initialize();
    return repo;
}
