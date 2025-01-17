import {strinvelop, Repository} from "@meshql/common"
import {RepositoryCertification} from "../../common/test/certification/repository.cert"
import { MongoMemoryServer } from "mongodb-memory-server";
import {PayloadRepository} from "../src/mongoRepo";
import {MongoClient} from "mongodb";

let mongod: MongoMemoryServer;
const mongos: MongoClient[] = []
const createRepository = async () : Promise<Repository<string>> => {
    if(!mongod) {
        mongod = await MongoMemoryServer.create();
    }

    let client: MongoClient = new MongoClient(mongod.getUri());
    await client.connect();

    let db = client.db("test")
    mongos.push(client)
    return new PayloadRepository(db.collection(crypto.randomUUID()));
}

const tearDown = async (): Promise<void> => {
    await Promise.all(mongos.map((client) => {
        client.close()
    }));
    await mongod.stop()
}
RepositoryCertification(createRepository, tearDown, strinvelop);