import {describe, beforeAll, afterAll, test, expect} from "@jest/globals";

import {Mock, It} from "moq.ts";

import {buildSchema, graphql} from "graphql";
import {context} from "../src/graph/root";
import {Repo} from "../src/repository/repo";
import {Auth} from "@meshql/auth";

const createdAt = new Date();

describe("GraphQL Configuration", () => {
    describe("Generating a simple root", () => {
        const simple: RootConfig = {
            singletons: [
                {
                    name: "getById",
                    query: '{"id": "{{id}}"}',
                },
                {
                    name: "getByFoo",
                    query: '{"payload.foo": "{{foo}}"}',
                },
            ],
        };

        const schema = buildSchema(/* GraphQL */ `
            type Test {
                id: ID
                foo: String
                eggs: Int
            }
            type Query {
                getById(id: String): Test
                getByFoo(foo: String): Test
            }
        `);

        test("should create a simple root", async () => {
            const query = /* GraphQL */ `
                {
                    getById(id: "test_id") {
                        eggs
                    }
                }
            `;

            let repo = new Mock<Repo>()
                .setup(async i => i.find(It.IsAny(), It.IsAny(), It.IsAny(), It.IsAny())).returnsAsync({
                    "id": "test_id",
                    "payload": {"foo": "bar", "eggs": 6},
                    createdAt,
                }).object();

            let auth = new Mock<Auth>()
                .setup(async i => i.getAuthToken(It.IsAny())).returnsAsync("TOKEN")
                .setup(async i => i.isAuthorized(It.IsAny(), It.IsAny())).returnsAsync(true).object()

            const {root} = context(repo, auth, simple);

            const response: Record<string, any> = await graphql({
                schema,
                source: query,
                rootValue: root,
            });


            if (response.errors) {
                console.error(response.errors);
                throw new Error("GraphQL returned errors");
            }

            expect(response.data?.getById?.eggs).toBe(6);
        });
    });
});