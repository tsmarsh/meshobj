import {SearcherCertification, Searcher, Envelope, TestTemplates} from "@meshql/common"
import { MongoMemoryServer } from "mongodb-memory-server";
import {PayloadRepository} from "../src/mongoRepo";
import {Collection, MongoClient} from "mongodb";
import {MongoSearcher} from "../src/mongoSearcher";
import {DTOFactory} from "@meshql/graphlette";
import {NoOp, Auth} from "@meshql/auth";
import {compile} from "handlebars";

const mongos: {server: MongoMemoryServer, client: MongoClient}[] = []

const createSearcher = async (data: Envelope<string>[]): Promise<{saved: Envelope<string>[], searcher: Searcher<string>}> => {
    let mongod: MongoMemoryServer = await MongoMemoryServer.create();
    let client: MongoClient = new MongoClient(mongod.getUri());
    await client.connect();
    mongos.push({server: mongod, client})
    let db = client.db("test")
    let collection: Collection<Envelope<string>> = db.collection("test");

    let dtoFactory = new DTOFactory([]);
    let auth: Auth = new NoOp();

    let repo = new PayloadRepository(collection);
    let saved = await repo.createMany(data);

    return {saved, searcher: new MongoSearcher(collection, dtoFactory, auth)};

}

const tearDown = async (): Promise<void> => {
    await Promise.all(mongos.map(({server, client}) => {
        client.close()
        server.stop()
    }));
}

const findById = `{"id": "{{id}}"}`
const findByName =`{"payload.name": "{{id}}"}`
const findAllByType = `{"payload.type": "{{id}}"}`;
const findByNameAndType = `{"payload.name": "{{name}}", "payload.type": "{{type}}"}`;

const templates: TestTemplates = {
    findById: compile(findById),
    findByName: compile(findByName),
    findAllByType: compile(findAllByType),
    findByNameAndType: compile(findByNameAndType)
}

SearcherCertification(createSearcher, tearDown, templates);