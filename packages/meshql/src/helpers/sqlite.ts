import { Database, open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { SQLConfig } from '../configTypes';
import { Repository } from '@meshql/common';
import { SQLiteSearcher, SQLiteRepository } from '@meshql/sqlite_repo';
import { Auth } from '@meshql/auth';
import { DTOFactory } from '../graphlette/graphlette';

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
