import Log4js from "log4js";
import {init} from "../index";

import {describe, test, expect, beforeAll, afterAll} from "@jest/globals";
import express, {Application, Express} from "express";
import {Auth} from "@meshql/auth";
import {Mock, It} from "moq.ts";
import {Repo} from "../src/repo";

let server: any;

const port = 40200;

const auth: Auth = new Mock<Auth>()
    .setup(async i => i.getAuthToken(It.IsAny())).returnsAsync("TOKEN")
    .setup(async i => i.secureData(It.IsAny(), It.IsAny())).returnsAsync({"id": "666", "payload": { "name": "chuck", "eggs": 6 }})
    .setup(async i => i.isAuthorized(It.IsAny(), It.IsAny())).returnsAsync(true).object()

const repo: Repo = new Mock<Repo>()
    .setup(async i => i.create(It.IsAny())).returnsAsync({"id": "666", "payload": { "name": "chuck", "eggs": 6 }})
    .setup(async i => i.list(It.IsAny())).returnsAsync([{"id": "666", "payload": { "name": "chuck", "eggs": 6 }}])
    .setup(async i => i.read(It.IsAny(), It.IsAny(), It.IsAny())).returnsAsync({"id": "666", "payload": { "name": "chuck", "eggs": 6 }}).object();

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
    const app: Express = express();
    app.use(express.json())
    let application = init(app, auth, repo, "/hens");

    server = application.listen(port);
});

afterAll(async () => {
    await server.close();
});

describe("simple restlette", () => {

    test("should create a document", async () => {
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

    // test("should list all documents", async () => {
    //     const response = await fetch("http://localhost:40020/hens", {
    //         headers: {
    //             "Content-Type": "application/json",
    //         },
    //     });
    //
    //     const actual = await response.json();
    //
    //     expect(actual.length).toBe(1);
    //     expect(actual[0]).toBe(`/hens/${id}`);
    // });
    //
    // test("should update a document", async () => {
    //     const response = await fetch(`http://localhost:40020/hens/${id}`, {
    //         method: "PUT",
    //         body: JSON.stringify({ name: "chuck", eggs: 9 }),
    //         redirect: "follow",
    //         headers: {
    //             "Content-Type": "application/json",
    //         },
    //     });
    //
    //     const actual = await response.json();
    //
    //     expect(actual.eggs).toBe(9);
    //     expect(actual.name).toBe("chuck");
    // });
    //
    // test("should delete a document", async () => {
    //     const response = await fetch(`http://localhost:40020/hens/${id}`, {
    //         method: "DELETE",
    //         redirect: "follow",
    //         headers: {
    //             "Content-Type": "application/json",
    //         },
    //     });
    //
    //     expect(response.status).toBe(200);
    // });
});