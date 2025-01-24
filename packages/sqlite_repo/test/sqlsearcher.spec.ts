import {Searcher, Envelope, Repository} from "@meshql/common"
import {SearcherCertification, TestTemplates} from "../../common/test/certification/searcher.cert"
import {DTOFactory} from "@meshql/graphlette";
import {NoOp, Auth} from "@meshql/auth";
import {compile} from "handlebars";
import {Database, open} from "sqlite";
import sqlite3 from "sqlite3";
import {SQLiteRepository} from "../src/sqliteRepo";
import {SQLiteSearcher} from "../src/sqliteSearcher";

const dbs: Database[] = []

const createSearcher = async (): Promise<{repository: Repository, searcher: Searcher}> => {
    let db = await open({filename: ":memory:", driver: sqlite3.Database});

    dbs.push(db)
    // Generate a random table name that is valid for SQLite
    const name = `tbl_${Math.random().toString(36).substring(2, 15)}`;
    let repo = new SQLiteRepository(db, name);

    await repo.initialize();

    let dtoFactory = new DTOFactory([]);
    let auth: Auth = new NoOp();

    return {repository: repo, searcher: new SQLiteSearcher(db, name, dtoFactory, auth)};

}

const tearDown = async (): Promise<void> => {
    await Promise.all(dbs.map((db) => {
        db.close();
    }));
}

const findById = `
            SELECT *
            FROM {{_name}}
            WHERE id = '{{id}}'
              AND created_at <= {{_created_at}}
            ORDER BY created_at DESC
            LIMIT 1`

const findByName =`
            SELECT *
            FROM {{_name}}
            WHERE json_extract(payload, '$.name') = '{{id}}'
              AND created_at <= {{_created_at}}
            ORDER BY created_at DESC
            LIMIT 1`

const findAllByType = `
SELECT t1.*
FROM {{_name}} t1
JOIN (
    SELECT id, MAX(created_at) AS max_created_at
    FROM {{_name}}
    WHERE json_extract(payload, '$.type') = '{{id}}'
      AND created_at <= {{_created_at}}
      AND deleted = 0
    GROUP BY id
) t2 ON t1.id = t2.id AND t1.created_at = t2.max_created_at
WHERE json_extract(t1.payload, '$.type') = '{{id}}'
  AND t1.created_at <= {{_created_at}}
  AND t1.deleted = 0`;

const findByNameAndType = `
SELECT t1.*
FROM {{_name}} t1
JOIN (
    SELECT id, MAX(created_at) AS max_created_at
    FROM {{_name}}
    WHERE json_extract(payload, '$.type') = '{{type}}'
      AND json_extract(payload, '$.name') = '{{name}}'
      AND created_at <= {{_created_at}}
      AND deleted = 0
    GROUP BY id
) t2 ON t1.id = t2.id AND t1.created_at = t2.max_created_at
WHERE json_extract(t1.payload, '$.type') = '{{type}}'
  AND json_extract(t1.payload, '$.name') = '{{name}}'
  AND t1.created_at <= {{_created_at}}
  AND t1.deleted = 0`;

const templates: TestTemplates = {
    findById: compile(findById),
    findByName: compile(findByName),
    findAllByType: compile(findAllByType),
    findByNameAndType: compile(findByNameAndType)
}

SearcherCertification(createSearcher, tearDown, templates);