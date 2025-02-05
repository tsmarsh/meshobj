import { createPool, PoolOptions, Pool as MySQLPool } from 'mysql2/promise';
import { Repository } from '@meshql/common';
import { MySQLRepository } from '@meshql/mysql_repo'; // Adjust import if your MySQL repo is named differently
import { DTOFactory } from '../graphlette/graphlette';
import { Auth } from '@meshql/auth';
import { MySQLSearcher } from '@meshql/mysql_repo';
import { MySQLConfig } from '../configTypes';

/**
 * Creates and returns a MySQL Pool connection.
 */
export function buildMySQLPool(config: MySQLConfig, pools: Record<string, MySQLPool>): MySQLPool {
    // Use relevant PoolOptions for MySQL
    const poolOptions: PoolOptions = {
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        database: config.db,
        waitForConnections: true,
        connectionLimit: 10,
        maxIdle: 10,
        idleTimeout: 60000,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
    };

    // Construct a unique key based on connection parameters
    const key = `${poolOptions.host}:${poolOptions.port}:${poolOptions.database}:${poolOptions.user}:${poolOptions.password}`;

    if (!pools[key]) {
        pools[key] = createPool(poolOptions);
    }
    return pools[key];
}

/**
 * Creates a MySQL-based repository with the given config.
 */
export async function createMySQLRepository(
    mysqlConfig: MySQLConfig,
    pools: Record<string, MySQLPool>,
): Promise<Repository> {
    const pool = buildMySQLPool(mysqlConfig, pools);
    // MySQLRepository mirrors PostgresRepository functionality
    const repo = new MySQLRepository(pool, mysqlConfig.table);
    await repo.initialize();
    return repo;
}

export function createMySQLSearcher(
    mysqlConfig: MySQLConfig,
    dtoFactory: DTOFactory,
    auth: Auth,
    pools: Record<string, MySQLPool>,
): MySQLSearcher {
    const pool = buildMySQLPool(mysqlConfig, pools);
    return new MySQLSearcher(pool, mysqlConfig.table, dtoFactory, auth);
}
