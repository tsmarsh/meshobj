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

        let repo = new Mock<Repo>()
            .setup(async i => i.find(It.IsAny(), It.IsAny(), It.IsAny(), It.IsAny())).returnsAsync({
                "id": "test_id",
                "payload": {"foo": "bar", "eggs": 6},
                createdAt,
            }).object();

        let auth = new Mock<Auth>()
            .setup(async i => i.getAuthToken(It.IsAny())).returnsAsync("TOKEN")
            .setup(async i => i.isAuthorized(It.IsAny(), It.IsAny())).returnsAsync(true).object()

        test("should create a simple root", async () => {
            const query = /* GraphQL */ `
                {
                    getById(id: "test_id") {
                        eggs
                    }
                }
            `;



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

    describe("Generating a simple vector root", () => {
        const vector = {
            singletons: [
                {
                    name: "getById",
                    query: '{"id": "{{id}}"}',
                },
            ],
            vectors: [
                {
                    name: "getByBreed",
                    query: '{"payload.breed": "{{breed}}"}',
                },
            ],
        };

        const schema = buildSchema(/* GraphQL */ `
            type Test {
                id: ID
                name: String
                eggs: Int
                breed: String
            }
            type Query {
                getById(id: String): Test
                getByBreed(breed: String): [Test]
            }
        `);


        const repo = new Mock<Repo>()
            .setup(async i => i.findAll(It.IsAny(), It.IsAny(), It.IsAny(), It.IsAny())).returnsAsync([
                {
                    id: "chick_1",
                    payload: { name: "henry", eggs: 3, breed: "chicken", id: "chick_1",},
                    createdAt,
                },{
                    id: "chick_2",
                    payload: { name: "harry", eggs: 4, breed: "chicken", id: "chick_2", },
                    createdAt,
                }
            ]).object();

        const auth = new Mock<Auth>()
            .setup(async i => i.getAuthToken(It.IsAny())).returnsAsync("TOKEN")
            .setup(async i => i.isAuthorized(It.IsAny(), It.IsAny())).returnsAsync(true).object()

        test("should create a simple vector root", async () => {

            const query = /* GraphQL */ `
                {
                    getByBreed(breed: "chicken") {
                        id
                        name
                    }
                }
            `;

            const { root } = context(repo, auth, vector);
            const response:any = await graphql({ schema, source: query, rootValue: root });

            if (response.errors) {
                console.error(response.errors);
                throw new Error("GraphQL returned errors");
            }

            const resultNames = response.data?.getByBreed?.map((d: any) => d.name);
            const resultIds = response.data?.getByBreed?.map((d: any) => d.id);

            expect(resultNames).toEqual(expect.arrayContaining(["henry", "harry"]));
            expect(resultIds).toEqual(expect.arrayContaining(["chick_1", "chick_2"]));
        });
    });
});