import { DockerComposeEnvironment } from 'testcontainers';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import { callSubgraph } from '@meshobj/graphlette';

describe('Farm Service Integration Tests', () => {
    let environment: DockerComposeEnvironment;
    let farmServiceUrl: string;
    
    beforeAll(async () => {
        // Start the docker-compose environment
        environment = await new DockerComposeEnvironment(
            path.resolve(__dirname, '..'),
            'docker-compose.yml'
        ).up();

        // Get the mapped port for the farm-service
        const farmService = environment.getContainer('farm-service');
        const farmServicePort = farmService.getMappedPort(3033);
        farmServiceUrl = `http://localhost:${farmServicePort}`;

        // Wait a bit for services to be fully ready
        await new Promise(resolve => setTimeout(resolve, 2000));
    }, 30000); // Increase timeout for container startup

    afterAll(async () => {
        if (environment) {
            await environment.down();
        }
    });

    it('should create and query a farm', async () => {
        // Create a farm using GraphQL mutation
        const createFarmQuery = `
            mutation {
                create(input: { name: "Test Farm" }) {
                    id
                    name
                }
            }
        `;

        const createResult = await callSubgraph(
            new URL(`${farmServiceUrl}/farm/graph`),
            createFarmQuery,
            'create'
        );

        expect(createResult.name).toBe('Test Farm');
        expect(createResult.id).toBeDefined();

        const farmId = createResult.id;

        // Query the created farm
        const getFarmQuery = `{
            getById(id: "${farmId}") {
                name
                coops {
                    name
                }
            }
        }`;

        const queryResult = await callSubgraph(
            new URL(`${farmServiceUrl}/farm/graph`),
            getFarmQuery,
            'getById'
        );

        expect(queryResult.name).toBe('Test Farm');
        expect(Array.isArray(queryResult.coops)).toBe(true);
    });

    it('should create a coop and associate it with a farm', async () => {
        // First create a farm
        const createFarmQuery = `
            mutation {
                create(input: { name: "Farm with Coop" }) {
                    id
                    name
                }
            }
        `;

        const farmResult = await callSubgraph(
            new URL(`${farmServiceUrl}/farm/graph`),
            createFarmQuery,
            'create'
        );

        const farmId = farmResult.id;

        // Create a coop associated with the farm
        const createCoopQuery = `
            mutation {
                create(input: { name: "Test Coop", farm_id: "${farmId}" }) {
                    id
                    name
                }
            }
        `;

        const coopResult = await callSubgraph(
            new URL(`${farmServiceUrl}/coop/graph`),
            createCoopQuery,
            'create'
        );

        expect(coopResult.name).toBe('Test Coop');
        expect(coopResult.id).toBeDefined();

        // Query the farm to verify the coop is associated
        const getFarmQuery = `{
            getById(id: "${farmId}") {
                name
                coops {
                    name
                }
            }
        }`;

        const queryResult = await callSubgraph(
            new URL(`${farmServiceUrl}/farm/graph`),
            getFarmQuery,
            'getById'
        );

        expect(queryResult.coops).toHaveLength(1);
        expect(queryResult.coops[0].name).toBe('Test Coop');
    });
}); 