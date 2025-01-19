import {MongoMemoryServer} from "mongodb-memory-server";
import {MongoClient} from "mongodb";
import {ServerCertificiation} from "../../meshql/test/the_farm.cert"
import Log4js from "log4js";

let mongod: MongoMemoryServer;
let uri: string;
let client: MongoClient;

Log4js.configure({
    appenders: {
        out: {
            type: "stdout",
        },
    },
    categories: {
        default: { appenders: ["out"], level: "trace" },
    },
});

let setup = async () => {
    try{
        mongod = await MongoMemoryServer.create();
    } catch (err){
        console.error(JSON.stringify(err));
    }

    uri = mongod.getUri();

    // Set environment variables
    process.env.MONGO_URI = uri;
    process.env.ENV = "test";
    process.env.PREFIX = "farm";
    process.env.PLATFORM_URL = "http://localhost:3033";
    globalThis.__MONGO_URI__ = uri;
    client = new MongoClient(globalThis.__MONGO_URI__);
    await client.connect();
}

let cleanup = async () => {
    if (client) await client.close();
    if (mongod) await mongod.stop();
}

let configPath = `${__dirname}/config/config.conf`;

ServerCertificiation(setup, cleanup, configPath);