import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MongoClient } from "mongodb";
import { callSubgraph } from "@meshql/graphlette";
import { init } from "../src/server";
import { Restlette } from "../src/configTypes";
import { Document, OpenAPIClientAxios } from "openapi-client-axios";
import {FastifyInstance} from "fastify";

let client: MongoClient;
let port: number;

let hen_api: any;
let coop_api: any;
let farm_api: any;

let app: FastifyInstance;

let farm_id: string, coop1_id: string, coop2_id: string;
const hen_ids: Record<string, string> = {};
let first_stamp: number;

beforeEach(async () => {
    // Connect to MongoDB
    client = new MongoClient(global.__MONGO_URI__);
    await client.connect();

    // Initialize and start the server

    app = await init(global.__CONFIG__);
    port = global.__CONFIG__.port;
    await app.listen({ port });

    // Build API clients
    const swagger_docs = await Promise.all(
        global.__CONFIG__.restlettes.map(async (restlette: Restlette) => {
            const response = await fetch(
                `http://localhost:${global.__CONFIG__.port}${restlette.path}/api-docs/swagger.json`
            );
            return await response.json();
        })
    );

    await buildApi(swagger_docs, global.__JWT_TOKEN__);

    // Build initial models in the database
    await buildModels();
});

afterEach(async () => {
    // Close the server and MongoDB connection
    if (app) await app.close();
    if (client) await client.close();
});

describe("The Farm", () => {
    it("should build a server with multiple nodes", async () => {
        const query = `{
      getById(id: "${farm_id}") {
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
            new URL(`http://localhost:${port}/farm/graph`),
            query,
            "getById",
            `Bearer ${global.__JWT_TOKEN__}`
        );

        expect(json.name).toBe("Emerdale");
        expect(json.coops.length).toBe(3);
    });

    // it("should answer simple queries", async () => {
    //     const query = `{
    //   getByName(name: "duck") {
    //     id
    //     name
    //   }
    // }`;
    //
    //     const json = await callSubgraph(
    //         new URL(`http://localhost:${port}/hen/graph`),
    //         query,
    //         "getByName",
    //         `Bearer ${global.__JWT_TOKEN__}`
    //     );
    //
    //     expect(json[0].id).toBe(hen_ids["duck"]);
    //     expect(json[0].name).toBe("duck");
    // });
    //
    // it("should query in both directions", async () => {
    //     const query = `{
    //   getByCoop(id: "${coop1_id}") {
    //     name
    //     eggs
    //     coop {
    //       name
    //       farm {
    //         name
    //       }
    //     }
    //   }
    // }`;
    //
    //     const json = await callSubgraph(
    //         new URL(`http://localhost:${port}/hen/graph`),
    //         query,
    //         "getByCoop",
    //         `Bearer ${global.__JWT_TOKEN__}`
    //     );
    //
    //     expect(json.length).toBe(2);
    //     expect(json.map((res: any) => res.name)).toEqual(
    //         expect.arrayContaining(["chuck", "duck"])
    //     );
    //     expect(json[0].coop.name).toBe("purple");
    // });
    //
    // it("should get latest by default", async () => {
    //     const query = `{
    //   getById(id: "${coop1_id}") {
    //     id
    //     name
    //   }
    // }`;
    //
    //     const json = await callSubgraph(
    //         new URL(`http://localhost:${port}/coop/graph`),
    //         query,
    //         "getById",
    //         `Bearer ${global.__JWT_TOKEN__}`
    //     );
    //
    //     expect(json.id).toBe(coop1_id);
    //     expect(json.name).toBe("purple");
    // });
    //
    // it("should get closest to the timestamp when specified", async () => {
    //     const query = `{
    //   getById(id: "${coop1_id}", at: ${first_stamp}) {
    //     name
    //   }
    // }`;
    //
    //     const json = await callSubgraph(
    //         new URL(`http://localhost:${port}/coop/graph`),
    //         query,
    //         "getById",
    //         `Bearer ${global.__JWT_TOKEN__}`
    //     );
    //
    //     expect(json.name).toBe("red");
    // });
    //
    // it("should obey the timestamps", async () => {
    //     const query = `{
    //   getById(id: "${farm_id}", at: ${first_stamp}) {
    //     coops {
    //       name
    //     }
    //   }
    // }`;
    //
    //     const json = await callSubgraph(
    //         new URL(`http://localhost:${port}/farm/graph`),
    //         query,
    //         "getById",
    //         `Bearer ${global.__JWT_TOKEN__}`
    //     );
    //
    //     const names = json.coops.map((c: any) => c.name);
    //     expect(names).not.toContain("purple");
    // });
    //
    // it("should pass timestamps to next layer", async () => {
    //     const query = `{
    //   getById(id: "${farm_id}", at: ${Date.now()}) {
    //     coops {
    //       name
    //     }
    //   }
    // }`;
    //
    //     const json = await callSubgraph(
    //         new URL(`http://localhost:${port}/farm/graph`),
    //         query,
    //         "getById",
    //         `Bearer ${global.__JWT_TOKEN__}`
    //     );
    //
    //     const names = json.coops.map((c: any) => c.name);
    //     expect(names).toContain("purple");
    // });
});

// Helper functions
async function buildApi(swagger_docs: Document[], token: string) {
    const authHeaders = { Authorization: `Bearer ${token}` };
    const apis = await Promise.all(
        swagger_docs.map(async (doc: Document) => {
            const api = new OpenAPIClientAxios({
                definition: doc,
                axiosConfigDefaults: { headers: authHeaders },
            });
            return await api.init();
        })
    );

    for (const api of apis) {
        if (Object.keys(api.paths)[0].includes("hen")) {
            hen_api = api;
        } else if (Object.keys(api.paths)[0].includes("coop")) {
            coop_api = api;
        } else if (Object.keys(api.paths)[0].includes("farm")) {
            farm_api = api;
        }
    }
}

async function buildModels() {
    const farm = await farm_api.create(null, { name: "Emerdale" });
    farm_id = farm.request.path.slice(-36);

    const coop1 = await coop_api.create(null, { name: "red", farm_id });
    coop1_id = coop1.request.path.slice(-36);

    const coop2 = await coop_api.create(null, { name: "yellow", farm_id });
    coop2_id = coop2.request.path.slice(-36);

    await coop_api.create(null, { name: "pink", farm_id });

    first_stamp = Date.now();

    await coop_api.update({ id: coop1_id }, { name: "purple", farm_id });

    const hens = [
        { name: "chuck", eggs: 2, coop_id: coop1_id },
        { name: "duck", eggs: 0, coop_id: coop1_id },
        { name: "euck", eggs: 1, coop_id: coop2_id },
        { name: "fuck", eggs: 2, coop_id: coop2_id },
    ];

    const savedHens = await Promise.all(hens.map((hen) => hen_api.create(null, hen)));
    savedHens.forEach((hen: any) => {
        hen_ids[hen.data.name] = hen.headers["x-canonical-id"];
    });
}