import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Log4js from "log4js";
import { init } from "../index"; // Assuming this initializes an Express app
import { Auth, NoOp } from "@meshql/auth";
import { InMemory } from "@meshql/memory_repo";
import { Envelope, Repository, Validator } from "@meshql/common";
import { Crud } from "../src/crud";
import { JSONSchemaValidator } from "../src/validation";
import express, { Application } from "express";

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

describe("Crud", () => {
    describe("A happy restlette", function () {
        let app: Application;
        let server: any;

        const port = 40200;

        afterAll(() => {
            server.close();
        });

        beforeAll(async () => {
            const auth: Auth = new NoOp();
            const repo: Repository<number> = new InMemory();
            await repo.create({ id: "666", payload: { name: "chuck", eggs: 6 } });

            app = express();
            app.use(express.json());

            const context = "/hens";
            const validator: Validator = async (data: Record<string, any>) => true;

            const crud: Crud<number> = new Crud(auth, repo, validator, context);
            init(app, crud, context);

            server = app.listen(port);
        });

        it("should create a document", async function () {
            const henData = { name: "chuck", eggs: 6 };
            const response = await fetch(`http://localhost:${port}/hens`, {
                method: "POST",
                body: JSON.stringify(henData),
                headers: {
                    "Content-Type": "application/json",
                },
            });

            expect(response.status).toBe(200); // `303` is returned by the `create` handler
            const payload: {eggs: number, name: string} = await response.json()
            expect(payload.name).toBe("chuck");
        });

        it("should list all documents", async () => {
            const response = await fetch(`http://localhost:${port}/hens`, {
                headers: {
                    "Content-Type": "application/json",
                },
            });

            const actual = await response.json();

            expect(actual.length).toBe(2);
            expect(actual[0]).toBe("/hens/10");
        });

        it("should update a document", async () => {
            const response = await fetch(`http://localhost:${port}/hens/10`, {
                method: "PUT",
                body: JSON.stringify({ name: "chuck", eggs: 9 }),
                headers: {
                    "Content-Type": "application/json",
                },
            });

            expect(response.status).toBe(200);
            const payload = await response.json();
            expect(payload.eggs).toBe(9);
        });

        it("should delete a document", async () => {
            const response = await fetch(`http://localhost:${port}/hens/10`, {
                method: "DELETE",
            });

            expect(response.status).toBe(200);
        });
    });

    describe("negative tests for simple restlette", function () {
        let app: Application;
        let server: any;

        const port = 40300;

        afterAll(() => {
            server.close();
        });

        beforeAll(async () => {
            const auth: Auth = new NoOp();
            const repo: Repository<number> = new InMemory();
            await repo.create({ id: "666", payload: { name: "chuck", eggs: 6 } });

            app = express();
            app.use(express.json());

            const context = "/hens";
            const validator: Validator = JSONSchemaValidator({
                $id: "henSchema",
                type: "object",
                properties: {
                    name: { type: "string", minLength: 1 },
                    eggs: { type: "integer", minimum: 0 },
                },
                required: ["name", "eggs"],
                additionalProperties: false,
            });

            const crud: Crud<number> = new Crud(auth, repo, validator, context);
            init(app, crud, context);

            server = app.listen(port);
        });

        it("should return 404 for non-existent document", async () => {
            const response = await fetch(`http://localhost:${port}/hens/999`, {
                method: "GET",
            });

            expect(response.status).toBe(404);
        });

        it("should return 400 for creating a document with invalid data", async () => {
            const invalidHenData = { eggs: "not a number" };
            const response = await fetch(`http://localhost:${port}/hens`, {
                method: "POST",
                body: JSON.stringify(invalidHenData),
                headers: {
                    "Content-Type": "application/json",
                },
            });

            expect(response.status).toBe(400);
        });
    });

    describe("authorization tests", function () {
        let app: Application;
        let server: any;
        let hen: Envelope<number>;

        const port = 40400;

        afterAll(() => {
            server.close();
        });

        beforeAll(async () => {
            const auth: Auth = {
                async getAuthToken(context: Record<string, any>): Promise<string[]> {
                    return [context.headers?.authorization ?? "fd"];
                },
                async isAuthorized(credentials: string[], data: Record<string, any>): Promise<boolean> {
                    return credentials[0] === "token";
                },
            };

            const repo: Repository<number> = new InMemory();
            hen = await repo.create({ id: "666", payload: { name: "chuck", eggs: 6 } });

            app = express();
            app.use(express.json());

            const context = "/hens";
            const validator: Validator = async (data) => true;

            const crud: Crud<number> = new Crud(auth, repo, validator, context);
            init(app, crud, context);

            server = app.listen(port);
        });

        it("should return 200 for authorized access", async () => {
            const response = await fetch(`http://localhost:${port}/hens/${hen.id}`, {
                method: "GET",
                headers: {
                    "Authorization": "token",
                },
            });

            expect(response.status).toBe(200);
        });

        it("should return 403 for unauthorized access", async () => {
            const response = await fetch(`http://localhost:${port}/hens/${hen.id}`, {
                method: "GET",
                headers: {
                    "Authorization": "InvalidToken",
                },
            });

            expect(response.status).toBe(403);
        });
    });
});