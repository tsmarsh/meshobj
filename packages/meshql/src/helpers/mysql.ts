import { createPool, PoolOptions, Pool as MySQLPool } from 'mysql2/promise';
import { Repository } from '@meshobj/common';
import { MySQLRepository } from '@meshobj/mysql_repo'; // Adjust import if your MySQL repo is named differently
import { DTOFactory } from '@meshobj/graphlette';
import { Auth } from '@meshobj/auth';
import { MySQLSearcher } from '@meshobj/mysql_repo';
import { MySQLConfig, StorageConfig } from '../configTypes';
import { Plugin } from '../plugin';
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

export class MySQLPlugin implements Plugin {
    private pools: Record<string, MySQLPool>;

    constructor() {
        this.pools = {};
    }

    async createRepository(config: StorageConfig) {
        return createMySQLRepository(config as MySQLConfig, this.pools);
    }

    async createSearcher(config: StorageConfig, dtoFactory: DTOFactory, auth: Auth) {
        return createMySQLSearcher(config as MySQLConfig, dtoFactory, auth, this.pools);
    }

    async cleanup() {
        for (const pool of Object.values(this.pools)) {
            await pool.end();
        }
    }
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
