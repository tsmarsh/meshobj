import { beforeAll, afterAll } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import * as jwt from "jsonwebtoken";
import express from "express";
import {init} from "../src/server";
import {Restlette} from "../src/configTypes";
import {Document, OpenAPIClient, OpenAPIClientAxios} from "openapi-client-axios";
import {get} from "axios";

let mongod: MongoMemoryServer;
let uri: string;

// Set global variables for use in tests
globalThis.__MONGO_URI__ = ""; // Placeholder for MongoDB URI
globalThis.__TOKEN__ = "";    // Placeholder for JWT token
globalThis.__CONFIG__ = {};

let app;
let client;

globalThis.farm_id = "";
globalThis.coop1_id = ""
globalThis.coop2_id = ""
globalThis.hen_ids = {};
globalThis.first_stamp = 0;

let hen_api: any;
let coop_api: any;
let farm_api: any;

function getRegisteredPaths(app: express.Application): Array<{ method: string; path: string }> {
    const routes: Array<{ method: string; path: string }> = [];

    app._router.stack.forEach((middleware: any) => {
        if (middleware.route) {
            // Routes registered directly on the app (e.g., app.get('/path'))
            const { path, methods } = middleware.route;
            Object.keys(methods).forEach((method) => {
                routes.push({ method: method.toUpperCase(), path });
            });
        } else if (middleware.name === "router") {
            // Routes registered on a router (e.g., router.get('/path'))
            middleware.handle.stack.forEach((handler: any) => {
                const { route } = handler;
                if (route) {
                    const { path, methods } = route;
                    Object.keys(methods).forEach((method) => {
                        routes.push({ method: method.toUpperCase(), path });
                    });
                }
            });
        }
    });

    return routes;
}

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

    // Connect to MongoDB
    client = new MongoClient(globalThis.__MONGO_URI__);
    await client.connect();

    // Initialize and start the Express app
    app = express();
    app = await init(globalThis.__CONFIG__);
    let port = globalThis.__CONFIG__.port;

    // let registeredPaths = getRegisteredPaths(app);
    // console.log(registeredPaths);
    // Start the server
    app.listen(port, () => {
        console.log(`Server running on http://localhost:${port}`);
    });

    // Build API clients
    const swagger_docs: Document[] = await Promise.all(
        globalThis.__CONFIG__.restlettes.map(async (restlette: Restlette) => {
            let url = `http://localhost:${globalThis.__CONFIG__.port}${restlette.path}/api-docs/swagger.json`;
            console.log("Url", url);
            const response = await fetch(
                url
            );
            return await response.json();
        })
    );

    await buildApi(swagger_docs, globalThis.__TOKEN__);

    // Build initial models in the database
    await buildModels();

});

afterAll(async () => {
    // Stop MongoDB server and clean up
    if (client) await client.close();
    if (mongod) await mongod.stop();
});


async function buildApi(swagger_docs: Document[], token: string) {
    const authHeaders = { Authorization: `Bearer ${token}` };
    const apis = await Promise.all(
        swagger_docs.map(async (doc: Document) => {
            if (!doc.paths || Object.keys(doc.paths).length === 0) {
                throw new Error(`Swagger document for ${doc.info.title} has no paths defined`);
            }

            const api = new OpenAPIClientAxios({
                definition: doc,
                axiosConfigDefaults: { headers: authHeaders },
            });

            return api.init();
        })
    );

    for (const api: OpenAPIClientAxios of apis) {
        if (Object.keys(api.paths)[0].includes("hen")) {
            hen_api = api;
        } else if (Object.keys(api.paths)[0].includes("coop")) {
            coop_api = api;
        } else if (Object.keys(api.paths)[0].includes("farm")) {
            farm_api = api;
        }
    }

    console.log("Swagger paths for Farm API:", Object.keys(farm_api.paths));
}

async function buildModels() {

    const farm = await farm_api.create(null, { name: "Emerdale" });
    console.log("Farm: ", JSON.stringify(farm));
    globalThis.farm_id = farm.request.path.slice(-36);

    const coop1 = await coop_api.create(null, { name: "red", farm_id: globalThis.farm_id });
    globalThis.coop1_id = coop1.request.path.slice(-36);

    const coop2 = await globalThis.coop_api.create(null, { name: "yellow", farm_id: globalThis.farm_id });
    globalThis.coop2_id = coop2.request.path.slice(-36);

    await coop_api.create(null, { name: "pink", farm_id: globalThis.farm_id });

    globalThis.first_stamp = Date.now();

    await coop_api.update({ id: globalThis.coop1_id }, { name: "purple", farm_id: globalThis.farm_id });

    const hens = [
        { name: "chuck", eggs: 2, coop_id: globalThis.coop1_id },
        { name: "duck", eggs: 0, coop_id: globalThis.coop1_id },
        { name: "euck", eggs: 1, coop_id: globalThis.coop2_id },
        { name: "fuck", eggs: 2, coop_id: globalThis.coop2_id },
    ];

    const savedHens = await Promise.all(hens.map((hen) => hen_api.create(null, hen)));
    savedHens.forEach((hen: any) => {
        globalThis.hen_ids[hen.data.name] = hen.headers["x-canonical-id"];
    });
}