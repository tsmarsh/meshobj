import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { callSubgraph } from "@meshql/graphlette";
import Log4js from "log4js";
import express, { Application } from "express";
import { Server } from "http";
import { init, cleanServer } from "../src/server";
import { Document, OpenAPIClient, OpenAPIClientAxios } from "openapi-client-axios";
import { Restlette } from "../src/configTypes";
import * as jwt from "jsonwebtoken";

globalThis.__MONGO_URI__ = ""; // Placeholder for MongoDB URI
globalThis.__TOKEN__ = "";    // Placeholder for JWT token
globalThis.__CONFIG__ = {};

let app: Application;
let server: Server;

globalThis.farm_id = "";
globalThis.coop1_id = ""
globalThis.coop2_id = ""
globalThis.hen_ids = {};
globalThis.first_stamp = 0;

let hen_api: any;
let coop_api: any;
let farm_api: any;

export function ServerCertificiation(setup, cleanup, configPath) {

    beforeAll(async () => {
        await setup();

        let env = process.env;

        const sub = "test-user";
        globalThis.__TOKEN__ = jwt.sign({ sub }, "totallyASecret", { expiresIn: "1h" });

        const parser = require("@pushcorn/hocon-parser");
        globalThis.__CONFIG__ = await parser.parse({ url: configPath });

        // Initialize and start the Express app
        app = await init(globalThis.__CONFIG__);
        let port = globalThis.__CONFIG__.port;

        server = await app.listen(port, () => {
            console.log(`Server running on http://localhost:${port}`);
        });

        // Build API clients
        const swagger_docs: Document[] = await getSwaggerDocs();

        await buildApi(swagger_docs, globalThis.__TOKEN__);

        await buildModels();
    });

    afterAll(async () => { 
        await cleanServer();
        if(server){
            server.close();
        }
        await cleanup();
    })

    describe("The Farm", () => {
        it("should build a server with multiple nodes", async () => {
            const query = `{
                getById(id: "${globalThis.farm_id}") {
                    name 
                    coops {
                        name
                        hens {
                            eggs
                            name
                        }
                    }
                }
            }`;

            const json = await callSubgraph(
                new URL(`http://localhost:${globalThis.__CONFIG__.port}/farm/graph`),
                query,
                "getById",
                `Bearer ${globalThis.__TOKEN__}`
            );

            expect(json.name).toBe("Emerdale");
            expect(json.coops.length).toBe(3);
        });

        it("should answer simple queries", async () => {
            const query = `{
                getByName(name: "duck") {
                    id
                    name
                }
            }`;

            const json = await callSubgraph(
                new URL(`http://localhost:${globalThis.__CONFIG__.port}/hen/graph`),
                query,
                "getByName",
                `Bearer ${globalThis.__TOKEN__}`
            );

            expect(json[0].id).toBe(globalThis.hen_ids["duck"]);
            expect(json[0].name).toBe("duck");
        });

        it("should query in both directions", async () => {
            const query = `{
                getByCoop(id: "${globalThis.coop1_id}") {
                    name
                    eggs
                    coop {
                        name
                        farm {
                            name
                        }
                    }
                }
            }`;

            const json = await callSubgraph(
                new URL(`http://localhost:${globalThis.__CONFIG__.port}/hen/graph`),
                query,
                "getByCoop",
                `Bearer ${globalThis.__TOKEN__}`
            );

            expect(json.length).toBe(2);
            expect(json.map((res: any) => res.name)).toEqual(
                expect.arrayContaining(["chuck", "duck"])
            );
            expect(json[0].coop.name).toBe("purple");
        });

        it("should get latest by default", async () => {
            const query = `{
                getById(id: "${globalThis.coop1_id}") {
                    id
                    name
                }
            }`;

            const json = await callSubgraph(
                new URL(`http://localhost:${globalThis.__CONFIG__.port}/coop/graph`),
                query,
                "getById",
                `Bearer ${globalThis.__TOKEN__}`
            );

            expect(json.id).toBe(globalThis.coop1_id);
            expect(json.name).toBe("purple");
        });

        it("should get closest to the timestamp when specified", async () => {
            const query = `{
                getById(id: "${globalThis.coop1_id}", at: ${globalThis.first_stamp}) {
                    name
                }
            }`;

            const json = await callSubgraph(
                new URL(`http://localhost:${globalThis.__CONFIG__.port}/coop/graph`),
                query,
                "getById",
                `Bearer ${globalThis.__TOKEN__}`
            );

            expect(json.name).toBe("red");
        });

        it("should obey the timestamps", async () => {
            const query = `{
                getById(id: "${globalThis.farm_id}", at: ${globalThis.first_stamp}) {
                    coops {
                    name
                    }
                }
            }`;

            const json = await callSubgraph(
                new URL(`http://localhost:${globalThis.__CONFIG__.port}/farm/graph`),
                query,
                "getById",
                `Bearer ${globalThis.__TOKEN__}`
            );

            const names = json.coops.map((c: any) => c.name);
            expect(names).not.toContain("purple");
        });

        it("should pass timestamps to next layer", async () => {
            const query = `{
                getById(id: "${globalThis.farm_id}", at: ${Date.now()}) {
                    coops {
                    name
                    }
                }
            }`;

            const json = await callSubgraph(
                new URL(`http://localhost:${globalThis.__CONFIG__.port}/farm/graph`),
                query,
                "getById",
                `Bearer ${globalThis.__TOKEN__}`
            );

            const names = json.coops.map((c: any) => c.name);
            expect(names).toContain("purple");
        });
    });

}


async function getSwaggerDocs() {
    return await Promise.all(
        globalThis.__CONFIG__.restlettes.map(async (restlette: Restlette) => {
            let url = `http://localhost:${globalThis.__CONFIG__.port}${restlette.path}/api-docs/swagger.json`;

            const response = await fetch(
                url
            );
            let doc = await response.json();
            return doc;
        })
    );
}


async function buildApi(swagger_docs: Document[], token: string) {
    const authHeaders = { Authorization: `Bearer ${token}` };
    const apis: OpenAPIClient[] = await Promise.all(
        swagger_docs.map(async (doc: Document): Promise<OpenAPIClient> => {
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

    for (const api of apis) {
        const firstPath = Object.keys(api.paths)[0];
        if (firstPath.includes("hen")) {
            hen_api = api;
        } else if (firstPath.includes("coop")) {
            coop_api = api;
        } else if (firstPath.includes("farm")) {
            farm_api = api;
        }
    }

}

async function buildModels() {

    const farm = await farm_api.create(null, { name: "Emerdale" });

    globalThis.farm_id = farm.request.path.slice(-36);

    const coop1 = await coop_api.create(null, { name: "red", farm_id: globalThis.farm_id });
    globalThis.coop1_id = coop1.request.path.slice(-36);

    const coop2 = await coop_api.create(null, { name: "yellow", farm_id: globalThis.farm_id });
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

    console.log("Hens:", JSON.stringify(globalThis.hen_ids))
}
