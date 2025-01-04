import {strinvelop, Repository, RepositoryCertification} from "@meshql/common"
import { MongoMemoryServer } from "mongodb-memory-server";
import {PayloadRepository} from "../src/mongoRepo";
import {MongoClient} from "mongodb";

const mongos: {server: MongoMemoryServer, client: MongoClient}[] = []
const createRepository = async () : Promise<Repository<string>> => {
    let mongod: MongoMemoryServer = await MongoMemoryServer.create();
    let client: MongoClient = new MongoClient(mongod.getUri());
    await client.connect();

    let db = client.db("test")
    mongos.push({server: mongod, client})
    return new PayloadRepository(db.collection("certification"));
}

const tearDown = async (): Promise<void> => {
    await Promise.all(mongos.map(({server, client}) => {
        client.close()
        server.stop()
    }));
}
RepositoryCertification(createRepository, tearDown, strinvelop);