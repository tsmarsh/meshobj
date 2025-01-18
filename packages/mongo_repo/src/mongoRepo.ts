import {v4 as uuid} from "uuid";
import Log4js from "log4js";
import {Collection, Document, Filter, UpdateResult} from "mongodb";
import {Envelope, Id, Repository} from "@meshql/common";

const logger = Log4js.getLogger("meshql/mongorepo");

function secureRead(tokens: string[], match: any): any {
    if (tokens.length > 0) {
        match.authorized_readers = {$in: tokens}
    }
    return match;
}

export class MongoRepository implements Repository<string>{
    private db: Collection<Envelope<string>>;

    constructor(db: Collection<Envelope<string>>) {
        this.db = db;
    }

    create = async (doc: Envelope<string>): Promise<Envelope<string>> => {
        doc.created_at = new Date();

        if (!Object.hasOwnProperty.call(doc, "id")) {
            doc.id = uuid();
        }

        await this.db.insertOne(doc, {
            writeConcern: {w: "majority"},
        });
        return doc
    };

    createMany = async (clean_docs: Envelope<string>[]): Promise<Envelope<string>[]> => {
        const created_at = new Date();
        const docs: Envelope<string>[] = clean_docs.map((doc) => {
            doc.created_at = created_at;
            doc.id = uuid();
            return doc;
        });

        try {
            await this.db.insertMany(docs);
        } catch (e) {
            logger.error(JSON.stringify(e, null, 2));
        }

        return docs;
    };

    read = async (id: Id<string>, tokens: string[] = [], created_at: Date = new Date()): Promise<Envelope<string>> => {
        let results: Envelope<string>[] = [];

        let filter: any = {
            id,
            created_at: {$lt: created_at},
            deleted: {$exists: false},
        }

        if(tokens.length > 0){
            filter.authorized_readers = { $in: tokens }
        }
        try {
            results = await this.db
                .find(filter)
                .sort({created_at: -1})
                .toArray();
        } catch (err) {
            logger.error(`Can't read: ${JSON.stringify(err)}`);
        }

        return results[0];
    };

    readMany = async (ids: Id<string>[], tokens: string[] = []): Promise<Envelope<string>[]> => {
        const match: any = {
            id: {$in: ids},
            deleted: {$exists: false}
        };
        secureRead(tokens, match);
        let results: Document[] = [];

        try {
            results = await this.db
                .aggregate([
                    {
                        $match: match,
                    },
                    {
                        $sort: {created_at: -1},
                    },
                    {
                        $group: {
                            _id: "$id",
                            doc: {$first: "$$ROOT"},
                        },
                    },
                    {
                        $replaceRoot: {newRoot: "$doc"},
                    },
                ])
                .toArray();
        } catch (err) {
            logger.error(`Error listing: ${JSON.stringify(err, null, 2)}`);
        }

        return results.map((d) => {return {id: d.id, created_at: d.created_at, payload: d.payload}});
    };

    remove = async (id: Id<string>, tokens: string[] = []): Promise<boolean> => {
        await this.db.updateMany(secureRead(tokens, {id}), {$set: {deleted: true}});
        return true;
    };

    removeMany = async (ids: Id<string>[], tokens: string[] = []): Promise<Record<Id<string>, boolean>> => {
        await this.db.updateMany(secureRead(tokens,
                                                {id: {$in: ids}}),
                                {$set: {deleted: true}});
        //hack: should compare match to modified then figure out what didn't get removed
        let result: Record<Id<string>, boolean> = {}
        for(let id of ids){
            result[id] = true
        }
        return result;
    };

    list = async (tokens:string[] = []): Promise<Envelope<string>[]> => {
        const match = secureRead(tokens, {deleted: {$exists: false}});

        let results: Document[] = [];

        try {
            results = await this.db
                .aggregate([
                    {
                        $match: match,
                    },
                    {
                        $sort: {created_at: -1},
                    },
                    {
                        $group: {
                            _id: "$id",
                            doc: {$first: "$$ROOT"},
                        },
                    },
                    {
                        $replaceRoot: {newRoot: "$doc"},
                    },
                ])
                .toArray();
        } catch (err) {
            logger.error(`Error listing: ${JSON.stringify(err)}`);
        }

        return results.map((d) => {return {id: d.id, created_at: d.created_at, payload: d.payload}});
    };
}