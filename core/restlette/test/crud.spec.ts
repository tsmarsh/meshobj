import Log4js from "log4js";
import {init} from "../index";

import {describe, test, expect, beforeAll, afterAll} from "@jest/globals";
import express, {Application, Express} from "express";
import {Auth, NoOp} from "@meshql/auth";
import {InMemory} from "../src/repo";
import {Envelope, Repository, Validator} from "@meshql/common";
import {Crud} from "../src/crud";
import {JSONSchemaValidator} from "../src/validation";
import e from "express";

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



describe("Crud", () => {
    describe("A happy restlette", function() {

        let server: any;

        const port = 40200;

        afterAll(async () => {
            await server.close();
        });

        beforeAll(async () => {
            const auth: Auth = new NoOp();
            const repo: Repository<number> = new InMemory();
            await repo.create({"id": "666", "payload": { "name": "chuck", "eggs": 6 }});
            const app: Express = express();
            app.use(express.json())
            let context = "/hens";
            let validator: Validator = async (data: Record<string, any>) => true;

            let crud:Crud<number> = new Crud(auth, repo, validator, context);
            let application = init(app, crud, context);

            server = application.listen(port);
        });

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

    describe("negative tests for simple restlette", function() {

        let server: any;

        const port = 40300;

        afterAll(async () => {
            await server.close();
        });

        beforeAll(async () => {
            const auth: Auth = new NoOp();
            const repo: Repository<number> = new InMemory();
            await repo.create({"id": "666", "payload": { "name": "chuck", "eggs": 6 }});
            const app: Express = express();
            app.use(express.json())
            let context = "/hens";
            let validator: Validator = JSONSchemaValidator({
                    $id: "henSchema",
                    type: "object",
                    properties: {
                        name: { type: "string", minLength: 1 },
                        eggs: { type: "integer", minimum: 0 },
                    },
                    required: ["name", "eggs"],
                    additionalProperties: false,
                }
            )

            let crud:Crud<number> = new Crud(auth, repo, validator, context);
            let application = init(app, crud, context);

            server = application.listen(port);
        });

        test("should return 404 for non-existent document", async () => {
            const response = await fetch(`http://localhost:${port}/hens/999`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            expect(response.status).toBe(404);
        });

        test("should return 400 for creating a document with invalid data", async () => {
            const invalidHenData = { eggs: "not a number" }; // Invalid eggs field
            const response = await fetch(`http://localhost:${port}/hens`, {
                method: "POST",
                body: JSON.stringify(invalidHenData),
                headers: {
                    "Content-Type": "application/json",
                },
            });

            expect(response.status).toBe(400);
        });

        test("should return 404 for updating a non-existent document", async () => {
            const response = await fetch(`http://localhost:${port}/hens/999`, {
                method: "PUT",
                body: JSON.stringify({ name: "non-existent", eggs: 10 }),
                headers: {
                    "Content-Type": "application/json",
                },
            });

            expect(response.status).toBe(404);
        });

        test("should return 400 for updating a document with invalid data", async () => {
            const response = await fetch(`http://localhost:${port}/hens/10`, {
                method: "PUT",
                body: JSON.stringify({ eggs: "invalid data" }), // Invalid eggs field
                headers: {
                    "Content-Type": "application/json",
                },
            });

            expect(response.status).toBe(400);
        });

        test("should return 404 for deleting a non-existent document", async () => {
            const response = await fetch(`http://localhost:${port}/hens/999`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            expect(response.status).toBe(404);
        });

        test("should handle missing Content-Type header for POST", async () => {
            const henData = { name: "chuck", eggs: 6 };
            const response = await fetch(`http://localhost:${port}/hens`, {
                method: "POST",
                body: JSON.stringify(henData), // Missing Content-Type header
            });

            expect(response.status).toBe(400);
        });

        test("should handle empty body for POST", async () => {
            const response = await fetch(`http://localhost:${port}/hens`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            expect(response.status).toBe(400);
        });

        test("should return 404 for unsupported HTTP method", async () => {
            const response = await fetch(`http://localhost:${port}/hens/10`, {
                method: "PATCH", // Unsupported method
                headers: {
                    "Content-Type": "application/json",
                },
            });

            expect(response.status).toBe(404);
        });
    });

    describe("authorization tests", function(){
        let server: any;

        const port = 40400;
        let hen: Envelope<number>;

        afterAll(async () => {
            await server.close();
        });

        beforeAll(async () => {
            const auth: Auth = {
                async getAuthToken(context: e.Request): Promise<string[]> {
                    return [context.headers?.authorization ?? "fd"];
                }, async isAuthorized(credentials: string[], data: Record<string, any>): Promise<boolean> {
                    return credentials[0] === "token";
                }

            }
            const repo: Repository<number> = new InMemory();
            hen = await repo.create({"id": "666", "payload": { "name": "chuck", "eggs": 6 }});
            const app: Express = express();
            app.use(express.json())
            let context = "/hens";
            let validator: Validator = async (data) => true;

            let crud:Crud<number> = new Crud(auth, repo, validator, context);
            let application = init(app, crud, context);

            server = application.listen(port);
        });

        test("should return 200 for authorized access", async () => {
            const response = await fetch(`http://localhost:${port}/hens/${hen.id}`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "token",
                },
            });

            expect(response.status).toBe(200);
        });

        test("should return 401 for unauthorized access", async () => {
            const response = await fetch(`http://localhost:${port}/hens/${hen.id}`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "InvalidToken", // Simulate an invalid token
                },
            });

            expect(response.status).toBe(403);
        });
    });

})
