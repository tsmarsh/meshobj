import { DockerComposeEnvironment, StartedDockerComposeEnvironment, Wait } from 'testcontainers';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import { callSubgraph } from '@meshobj/graphlette';
import { Document, OpenAPIClient, OpenAPIClientAxios } from 'openapi-client-axios';

let raw_event_id = '';
let processed_event_id = '';

let raw_event_api: any;
let processed_event_api: any;

let environment: StartedDockerComposeEnvironment;

describe('Events Service Smoke Test', () => {
    beforeAll(async () => {
        // Start the docker-compose environment
        environment = await new DockerComposeEnvironment(path.resolve(__dirname, '..'), 'docker-compose.yml')
            .withBuild()
            .withWaitStrategy('events_1', Wait.forHttp('/ready', 4055).withStartupTimeout(120000))
            .up();

        const swagger_docs: Document[] = await getSwaggerDocs();
        await buildApi(swagger_docs, '');
        await buildModels();
    }, 120000); // Increase timeout for container startup

    afterAll(async () => {
        if (environment) {
            await environment.down();
        }
    });

    it('should create and link raw and processed events', async () => {
        const query = `{
            getByName(name: "user_login") {
                id
                name
                data
                timestamp
                source
            }
        }`;

        const json = await callSubgraph(new URL(`http://localhost:4055/raw-events/graph`), query, 'getByName', null);

        expect(json.length).toBe(1);
        expect(json[0].name).toBe('user_login');
        expect(json[0].source).toBe('auth_service');
    });

    it('should query processed events and resolve raw event relationship', async () => {
        const query = `{
            getByName(name: "user_login") {
                id
                name
                processed_data
                status
                rawEvent {
                    id
                    name
                    data
                    source
                }
            }
        }`;

        const json = await callSubgraph(new URL(`http://localhost:4055/processed-events/graph`), query, 'getByName', null);

        expect(json.length).toBe(1);
        expect(json[0].name).toBe('user_login');
        expect(json[0].status).toBe('SUCCESS');
        expect(json[0].rawEvent).toBeDefined();
        expect(json[0].rawEvent.id).toBe(raw_event_id);
        expect(json[0].rawEvent.name).toBe('user_login');
    });

    it('should query processed events by raw event id', async () => {
        const query = `{
            getByRawEventId(raw_event_id: "${raw_event_id}") {
                id
                name
                status
                processing_time_ms
            }
        }`;

        const json = await callSubgraph(new URL(`http://localhost:4055/processed-events/graph`), query, 'getByRawEventId', null);

        expect(json.length).toBe(1);
        expect(json[0].name).toBe('user_login');
        expect(json[0].status).toBe('SUCCESS');
        expect(json[0].processing_time_ms).toBeGreaterThan(0);
    });
}, 120000);

async function getSwaggerDocs() {
    return await Promise.all(
        ['/raw-events', '/processed-events'].map(async (restlette) => {
            let url = `http://localhost:4055${restlette}/api/api-docs/swagger.json`;

            const response = await fetch(url);

            let doc = await response.json();
            return doc;
        }),
    );
}

async function buildApi(swagger_docs: Document[], token: string) {
    const authHeaders = { Authorization: `Bearer ${token}` };

    const apis: OpenAPIClient[] = await Promise.all(
        swagger_docs.map(async (doc: Document): Promise<OpenAPIClient> => {
            if (!doc.paths || Object.keys(doc.paths).length === 0) {
                throw new Error(`Swagger document for ${doc.info.title} has no paths defined`);
            }

            const api = new OpenAPIClientAxios({
                definition: doc,
                axiosConfigDefaults: { headers: authHeaders },
            });

            return api.init();
        }),
    );

    for (const api of apis) {
        const firstPath = Object.keys(api.paths)[0];
        if (firstPath.includes('raw-events')) {
            raw_event_api = api;
        } else if (firstPath.includes('processed-events')) {
            processed_event_api = api;
        }
    }
}

async function buildModels() {
    // Create a raw event
    const raw_event = await raw_event_api.create(null, {
        name: 'user_login',
        data: {
            user_id: 'user123',
            username: 'john_doe',
            ip_address: '192.168.1.100',
            user_agent: 'Mozilla/5.0...'
        },
        timestamp: new Date().toISOString(),
        source: 'auth_service',
        version: '1.0',
        metadata: {
            session_id: 'sess_abc123',
            device_type: 'desktop'
        }
    });

    raw_event_id = raw_event.request.path.slice(-36);

    // Create a processed event linked to the raw event
    const processed_event = await processed_event_api.create(null, {
        raw_event_id,
        name: 'user_login',
        processed_data: {
            user_id: 'user123',
            username: 'john_doe',
            login_country: 'US',
            risk_score: 0.1,
            is_suspicious: false
        },
        processed_timestamp: new Date().toISOString(),
        processing_time_ms: 45.2,
        status: 'SUCCESS',
        processor_version: '2.1.0',
        enrichment_data: {
            country_code: 'US',
            city: 'New York',
            timezone: 'America/New_York'
        }
    });

    processed_event_id = processed_event.request.path.slice(-36);
}