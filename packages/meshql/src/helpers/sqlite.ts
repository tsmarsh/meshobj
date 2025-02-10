import { Database, open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { SQLConfig, StorageConfig } from '../configTypes';
import { Repository } from '@meshobj/common';
import { SQLiteSearcher, SQLiteRepository } from '@meshobj/sqlite_repo';
import { Auth } from '@meshobj/auth';
import { DTOFactory } from '@meshobj/graphlette';
import { Plugin } from '../plugin';

/**
 * Helper that opens SQLite and returns the Database reference.
 */

export async function buildSqliteDb(sqlConfig: SQLConfig): Promise<Database<sqlite3.Database, sqlite3.Statement>> {
    const db = await open({
        filename: sqlConfig.uri,
        driver: sqlite3.Database,
    });
    return db;
}

export class SQLitePlugin implements Plugin {
    async createRepository(config: StorageConfig) {
        return createSQLiteRepository(config as SQLConfig);
    }
    
    async createSearcher(config: StorageConfig, dtoFactory: DTOFactory, auth: Auth) {
        return createSQLiteSearcher(config as SQLConfig, dtoFactory, auth);
    }

    async cleanup() {
        // SQLite does not require explicit cleanup
    }
}   

/**
 * Creates a SQLiteSearcher with the given config, DTO factory, and auth.
 */
export async function createSQLiteSearcher(sqlConfig: SQLConfig, dtoFactory: DTOFactory, auth: Auth) {
    const db = await buildSqliteDb(sqlConfig);
    return new SQLiteSearcher(db, sqlConfig.collection, dtoFactory, auth);
}

/**
 * Creates a SQLiteRepository with the given config.
 */
export async function createSQLiteRepository(sqlConfig: SQLConfig): Promise<Repository> {
    const db = await buildSqliteDb(sqlConfig);
    const repo = new SQLiteRepository(db, sqlConfig.collection);
    await repo.initialize();
    return repo;
}
