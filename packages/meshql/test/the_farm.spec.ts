import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import jwt from "jsonwebtoken";
import { v4 as uuid } from "uuid";
import { callSubgraph } from "@meshql/graphlette";
import {init} from "../src/server"
import parser from "@pushcorn/hocon-parser";

let mongod: MongoMemoryServer;
let client: MongoClient;
let uri: string;

let config: any;
let server: any;

let hen_api: any;
let coop_api: any;
let farm_api: any;

let port: number;
let token: string;
const sub = uuid();

let farm_id: string, coop1_id: string, coop2_id: string;
const hen_ids: Record<string, string> = {};
let first_stamp: number;

beforeAll(async () => {
    jest.setTimeout(20000);

    mongod = await MongoMemoryServer.create({ instance: { port: 60504 } });
    uri = mongod.getUri();
    client = new MongoClient(uri);
    setEnVars();

    await client.connect();

    config = await parser.parse(__dirname + "/config/config.conf");
    const app = init(config);

    port = config.port;

    server = app.listen(port);

    const swagger_docs = await Promise.all(
        config.restlettes.map(async (restlette: any) => {
            const response = await fetch(
                "http://localhost:3033" + restlette.path + "/api-docs/swagger.json"
            );
            const text = await response.text();

            return JSON.parse(text);
        })
    );

    token = jwt.sign({ sub }, "totallyASecret", { expiresIn: "1h" });
    await buildApi(swagger_docs);
    await buildModels();
});

afterAll(async () => {
    await mongod.stop();
    server.close();
    process.chdir(__dirname + "/..");
});

describe("The Farm", () => {
    jest.setTimeout(20000);

    test("should build a server with multiple nodes", async () => {
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
            `http://localhost:${port}/farm/graph`,
            query,
            "getById",
            "Bearer " + token
        );

        expect(json.name).toBe("Emerdale");
        expect(json.coops.length).toBe(3);
    });

    test("should answer simple queries", async () => {
        const query = `{
      getByName(name: "duck") {
        id
        name
      }
    }`;

        const json = await callSubgraph(
            `http://localhost:${port}/hen/graph`,
            query,
            "getByName",
            "Bearer " + token
        );

        expect(json[0].id).toBe(hen_ids["duck"]);
        expect(json[0].name).toBe("duck");
    });

    test("should query in both directions", async () => {
        const query = `{
      getByCoop(id: "${coop1_id}") {
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
            `http://localhost:${port}/hen/graph`,
            query,
            "getByCoop",
            "Bearer " + token
        );

        expect(json.length).toBe(2);
        expect(json.map((res: any) => res.name)).toEqual(
            expect.arrayContaining(["chuck", "duck"])
        );
        expect(json[0].coop.name).toBe("purple");
    });

    test("should get latest by default", async () => {
        const query = `{
      getById(id: "${coop1_id}") {
        id
        name
      }
    }`;

        const json = await callSubgraph(
            `http://localhost:${port}/coop/graph`,
            query,
            "getById",
            "Bearer " + token
        );

        expect(json.id).toBe(coop1_id);
        expect(json.name).toBe("purple");
    });

    test("should get closest to the timestamp when specified", async () => {
        const query = `{
      getById(id: "${coop1_id}", at: ${first_stamp}) {
        name
      }
    }`;

        const json = await callSubgraph(
            `http://localhost:${port}/coop/graph`,
            query,
            "getById",
            "Bearer " + token
        );

        expect(json.name).toBe("red");
    });

    test("should obey the timestamps", async () => {
        const query = `{
      getById(id: "${farm_id}", at: ${first_stamp}) {
        coops {
          name
        }
      }
    }`;

        const json = await callSubgraph(
            `http://localhost:${port}/farm/graph`,
            query,
            "getById",
            "Bearer " + token
        );

        const names = json.coops.map((c: any) => c.name);
        expect(names).not.toContain("purple");
    });

    test("should pass timestamps to next layer", async () => {
        const query = `{
      getById(id: "${farm_id}", at: ${Date.now()}) {
        coops {
          name
        }
      }
    }`;

        const json = await callSubgraph(
            `http://localhost:${port}/farm/graph`,
            query,
            "getById",
            "Bearer " + token
        );

        const names = json.coops.map((c: any) => c.name);
        expect(names).toContain("purple");
    });

    test("should have built-in documentation", async () => {
        const response = await fetch("http://localhost:3033/");
        const text = await response.text();

        const $ = cheerio.load(text);
        const graphlettes = $("#graphlettes li");
        const restlettes = $("#restlettes li");

        expect(graphlettes.length).toBe(3);
        expect(restlettes.length).toBe(3);
    });
});

async function buildApi(swagger_docs: any[]) {
    const apis = await Promise.all(
        swagger_docs.map(async (doc: any) => {
            const api = new OpenAPIClientAxios({
                definition: doc,
                axiosConfigDefaults: {
                    headers: {
                        Authorization: "Bearer " + token,
                    },
                },
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
    const farm_1 = await farm_api.create(null, { name: "Emerdale" });
    farm_id = farm_1.request.path.slice(-36);

    const coop_1 = await coop_api.create(null, {
        name: "red",
        farm_id,
    });
    coop1_id = coop_1.request.path.slice(-36);

    const coop_2 = await coop_api.create(null, {
        name: "yellow",
        farm_id,
    });
    coop2_id = coop_2.request.path.slice(-36);

    await coop_api.create(null, {
        name: "pink",
        farm_id,
    });

    first_stamp = Date.now();

    await coop_api.update(
        { id: coop1_id },
        { name: "purple", farm_id }
    );

    const hens = [
        { name: "chuck", eggs: 2, coop_id: coop1_id },
        { name: "duck", eggs: 0, coop_id: coop1_id },
        { name: "euck", eggs: 1, coop_id: coop2_id },
        { name: "fuck", eggs: 2, coop_id: coop2_id },
    ];

    const saved_hens = await Promise.all(
        hens.map((hen) => hen_api.create(null, hen))
    );

    saved_hens.forEach((hen: any) => {
        hen_ids[hen.data.name] = hen.headers["x-canonical-id"];
    });
}

function setEnVars() {
    process.env["MONGO_URI"] = uri;
    process.env["ENV"] = "test";
    process.env["PREFIX"] = "farm";
    process.env["PLATFORM_URL"] = "http://localhost:3033";
}