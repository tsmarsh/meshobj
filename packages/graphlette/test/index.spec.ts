import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import * as jwt from "jsonwebtoken";
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe.skip("MeshQL Server Integration", () => {
    let mongod: MongoMemoryServer;
    let mongoUri: string;
    let serverProcess: any;
    const TEST_PORT = 3456;
    
    beforeAll(async () => {
        // Start MongoDB Memory Server
        mongod = await MongoMemoryServer.create();
        mongoUri = mongod.getUri();

        // Create test config file
        const configContent = `
            port = ${TEST_PORT}
            restlettes = [
                {
                    path = "/hen"
                    storage = {
                        type = "mongo"
                        uri = "${mongoUri}"
                        db = "test"
                        collection = "hens"
                    }
                    schema = {
                        type = "object"
                        properties = {
                            name = { type = "string" }
                            eggs = { type = "integer" }
                        }
                        required = ["name"]
                    }
                }
            ]
        `;

        // Write config to temp file
        fs.writeFileSync('test_config.conf', configContent);

        // Start the server process
        process.env.ENV = "test";
        process.env.PREFIX = "farm";
        process.env.PLATFORM_URL = "http://localhost:3033";
        
        // Start server in background
        serverProcess = await execAsync(`ts-node src/index.ts --config ../test_config.conf`);
        
        // Give server time to start
        await new Promise(resolve => setTimeout(resolve, 2000));
    });

    afterAll(async () => {
        // Cleanup
        if (serverProcess) {
            process.kill(serverProcess.pid);
        }
        if (mongod) {
            await mongod.stop();
        }
        // Remove test config
        fs.unlinkSync('test_config.conf');
    });

    it("should create and retrieve a document via REST API", async () => {
        const henData = { name: "testHen", eggs: 3 };
        
        // Create hen
        const createResponse = await fetch(`http://localhost:${TEST_PORT}/hen`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(henData)
        });

        expect(createResponse.status).toBe(200);
        const createResult = await createResponse.json();
        expect(createResult.name).toBe("testHen");
        expect(createResult.eggs).toBe(3);

        // Get hen by ID
        const getResponse = await fetch(`http://localhost:${TEST_PORT}/hen/${createResult.id}`);
        expect(getResponse.status).toBe(200);
        const getResult = await getResponse.json();
        expect(getResult.name).toBe("testHen");
    });

    it("should create and query a document via GraphQL", async () => {
        const henData = { name: "graphqlHen", eggs: 5 };
        
        // First create via REST
        const createResponse = await fetch(`http://localhost:${TEST_PORT}/hen`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(henData)
        });
        
        const createResult = await createResponse.json();

        // Then query via GraphQL
        const query = `{
            getById(id: "${createResult.id}") {
                name
                eggs
            }
        }`;

        const graphqlResponse = await fetch(`http://localhost:${TEST_PORT}/hen/graph`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query })
        });

        expect(graphqlResponse.status).toBe(200);
        const graphqlResult = await graphqlResponse.json();
        expect(graphqlResult.data.getById.name).toBe("graphqlHen");
        expect(graphqlResult.data.getById.eggs).toBe(5);
    });
});