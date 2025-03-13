import { Repository } from '@meshobj/common';
import { RepositoryCertification } from '../../common/test/certification/repository.cert';
import { SQLiteRepository } from '../src/sqliteRepo';
import { open, Database } from 'sqlite';
import sqlite3 from 'sqlite3';

const dbs: Database<sqlite3.Database, sqlite3.Statement>[] = [];

const createRepository = async (): Promise<Repository> => {
    let db = await open({ filename: ':memory:', driver: sqlite3.Database });

    dbs.push(db);

    let repo = new SQLiteRepository(db, 'test');

    await repo.initialize();

    return repo;
};

const tearDown = async (): Promise<void> => {
    await Promise.all(
        dbs.map((db) => {
            db.close();
        }),
    );
};

RepositoryCertification(createRepository, tearDown);
