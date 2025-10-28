import { Before, After, AfterAll } from '@cucumber/cucumber';
import { TestWorld } from '@meshobj/common/test/support/world';
import { SQLiteRepository } from '../../src/sqliteRepo';
import { SQLiteSearcher } from '../../src/sqliteSearcher';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { compile } from 'handlebars';
import { DTOFactory } from '@meshobj/graphlette';
import { NoOp } from '@meshobj/auth';

let dbs: Database[] = [];

Before(async function(this: TestWorld) {
    this.createRepository = async () => {
        const db = await open({
            filename: ':memory:',
            driver: sqlite3.Database,
        });
        dbs.push(db);

        const repo = new SQLiteRepository(db, `test_${Date.now()}_${Math.random()}`);
        await repo.initialize();
        return repo;
    };

    this.createSearcher = async () => {
        const db = await open({
            filename: ':memory:',
            driver: sqlite3.Database,
        });
        dbs.push(db);

        const tableName = `test_${Date.now()}_${Math.random()}`;
        const repo = new SQLiteRepository(db, tableName);
        await repo.initialize();

        const dtoFactory = new DTOFactory([]);
        const auth = new NoOp();
        const searcher = new SQLiteSearcher(db, tableName, dtoFactory, auth);

        return { repository: repo, searcher };
    };

    this.tearDown = async () => {
        await Promise.all(dbs.map(db => db.close()));
        dbs = [];
    };

    // Templates for searcher tests - SQLite syntax
    this.templates = {
        findById: compile(`id = '{{id}}'`),
        findByName: compile(`json_extract(payload, '$.name') = '{{id}}'`),
        findAllByType: compile(`json_extract(payload, '$.type') = '{{id}}'`),
        findByNameAndType: compile(`json_extract(payload, '$.type') = '{{type}}' AND json_extract(payload, '$.name') = '{{name}}'`),
    };
});

After(async function(this: TestWorld) {
    // Per-scenario cleanup handled by tearDown
});

AfterAll(async function(this: TestWorld) {
    if (this.tearDown) {
        await this.tearDown();
    }
});
