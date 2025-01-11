import { beforeAll, afterAll } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import * as jwt from "jsonwebtoken";

let mongod: MongoMemoryServer;
let uri: string;

// Set global variables for use in tests
globalThis.__MONGO_URI__ = ""; // Placeholder for MongoDB URI
globalThis.__TOKEN__ = "";    // Placeholder for JWT token
globalThis.__CONFIG__ = {};
beforeAll(async () => {
    // Start in-memory MongoDB server
    mongod = await MongoMemoryServer.create();
    uri = mongod.getUri();

    // Set environment variables
    process.env.MONGO_URI = uri;
    process.env.ENV = "test";
    process.env.PREFIX = "farm";
    process.env.PLATFORM_URL = "http://localhost:3033";

    // Generate a test JWT token
    const sub = "test-user";
    globalThis.__TOKEN__ = jwt.sign({ sub }, "totallyASecret", { expiresIn: "1h" });

    // Assign MongoDB URI for test usage
    globalThis.__MONGO_URI__ = uri;

    const configPath = `${__dirname}/config/config.conf`;
    const parser = require("@pushcorn/hocon-parser");
    globalThis.__CONFIG__ = await parser.parse({ url: configPath });

});

afterAll(async () => {
    // Stop MongoDB server and clean up
    if (mongod) await mongod.stop();
});