import {Searcher, Envelope} from "@meshql/common"
import {SearcherCertification, TestTemplates} from "../../common/test/certification/searcher.cert"
import {DTOFactory} from "@meshql/graphlette";
import {NoOp, Auth} from "@meshql/auth";
import {compile} from "handlebars";
import {Database, open} from "sqlite";
import sqlite3 from "sqlite3";
import {SQLiteRepository} from "../src/sqliteRepo";
import {SQLiteSearcher} from "../src/sqliteSearcher";

const dbs: Database[] = []

const createSearcher = async (data: Envelope<string>[]): Promise<{saved: Envelope<string>[], searcher: Searcher<string>}> => {
    let db = await open({filename: ":memory:", driver: sqlite3.Database});

    dbs.push(db)
    let repo = new SQLiteRepository(db, "test");

    await repo.initialize();

    let dtoFactory = new DTOFactory([]);
    let auth: Auth = new NoOp();

    let saved = await repo.createMany(data);

    return {saved, searcher: new SQLiteSearcher(db, dtoFactory, auth)};

}

const tearDown = async (): Promise<void> => {
    await Promise.all(dbs.map((db) => {
        db.close();
    }));
}

const findById = `
            SELECT *
            FROM test
            WHERE id = '{{id}}'
              AND createdAt <= {{_createdAt}}
            ORDER BY createdAt DESC
            LIMIT 1`

const findByName =`
            SELECT *
            FROM test
            WHERE json_extract(payload, '$.name') = '{{id}}'
              AND createdAt <= {{_createdAt}}
            ORDER BY createdAt DESC
            LIMIT 1`

const findAllByType = `
            SELECT *
            FROM test
            WHERE json_extract(payload, '$.type') = '{{id}}'
              AND createdAt <= {{_createdAt}}
            ORDER BY createdAt DESC`;

const findByNameAndType = `
            SELECT *
            FROM test
            WHERE json_extract(payload, '$.type') = '{{type}}'
              AND json_extract(payload, '$.name') = '{{name}}'
              AND createdAt <= {{_createdAt}}
            ORDER BY createdAt DESC`;

const templates: TestTemplates = {
    findById: compile(findById),
    findByName: compile(findByName),
    findAllByType: compile(findAllByType),
    findByNameAndType: compile(findByNameAndType)
}

SearcherCertification(createSearcher, tearDown, templates);