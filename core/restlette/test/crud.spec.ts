import Log4js from "log4js";
import {init} from "../index";

import {describe, test, expect, beforeAll, afterAll} from "@jest/globals";
import express, {Express} from "express";
import {Auth, NoOp} from "@meshql/auth";
import {Repo, InMemory} from "../src/repo";
import {Bulk} from "../src/bulk";
import {Crud} from "../src/crud";

let server: any;

const port = 40200;

Log4js.configure({
    appenders: {
        out: {
            type: "stdout",
        },
    },
    categories: {
        default: {appenders: ["out"], level: "trace"},
    },
});

beforeAll(async () => {
    const auth: Auth = new NoOp();
    const repo: Repo<number, Record<string, any>> = new InMemory();
    await repo.create({"id": "666", "payload": { "name": "chuck", "eggs": 6 }});
    const app: Express = express();
    app.use(express.json())
    let context = "/hens";

    let bulk:Bulk<number, Record<string, any>> = new Bulk(auth, repo, context);
    let crud:Crud<number> = new Crud(auth, repo, context);
    let application = init(app, crud, bulk, context);

    server = application.listen(port);
});

afterAll(async () => {
    await server.close();
});

describe("simple restlette", function() {

    test("should create a document", async function() {
        const henData = {name: "chuck", eggs: 6};
        const hen = JSON.stringify(henData);

        const response = await fetch(`http://localhost:${port}/hens`, {
            method: "POST",
            body: hen,
            redirect: "follow",
            headers: {
                "Content-Type": "application/json",
            },
        });

        expect(response.status).toBe(200);

        const actual = await response.json();

        expect(actual.eggs).toBe(6);
        expect(actual.name).toBe("chuck");
    });

    test("should list all documents", async () => {
        const response = await fetch(`http://localhost:${port}/hens`, {
            headers: {
                "Content-Type": "application/json",
            },
        });

        const actual = await response.json();

        expect(actual.length).toBe(2);
        expect(actual[0]).toBe(`/hens/10`);
    });

    test("should update a document", async () => {
        const response = await fetch(`http://localhost:${port}/hens/10`, {
            method: "PUT",
            body: JSON.stringify({ name: "chuck", eggs: 9 }),
            redirect: "follow",
            headers: {
                "Content-Type": "application/json",
            },
        });

        const actual = await response.json();

        expect(actual.eggs).toBe(9);
        expect(actual.name).toBe("chuck");
    });

    test("should delete a document", async () => {
        const response = await fetch(`http://localhost:40200/hens/10`, {
            method: "DELETE",
            redirect: "follow",
            headers: {
                "Content-Type": "application/json",
            },
        });

        expect(response.status).toBe(200);
    });
});