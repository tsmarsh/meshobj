import { describe, it, expect, beforeAll } from 'vitest';
import { Kafka } from 'kafkajs';
import { Document, OpenAPIClient, OpenAPIClientAxios } from 'openapi-client-axios';

let raw_event_api: any;
let processed_event_api: any;
let kafka: Kafka;

// Generate a unique test run ID to avoid conflicts with previous test data
const TEST_RUN_ID = Date.now();

// NOTE: These tests expect a running Kubernetes cluster with all services deployed.
// Run: bash k8s/setup-kind.sh ci
// The tests are idempotent and can be run multiple times without cluster restart.
//
// Skipped in CI environments (when CI=true) - run manually for development
describe.skipIf(process.env.CI === 'true')('Events Service BDD Tests', () => {
    beforeAll(async () => {
        console.log(`Test run ID: ${TEST_RUN_ID}`);

        // Initialize Kafka client (use host listener)
        kafka = new Kafka({
            clientId: 'events-bdd-test',
            brokers: ['localhost:9092']
        });

        // Build API clients
        const swagger_docs: Document[] = await getSwaggerDocs();
        await buildApi(swagger_docs);

        console.log('Setup complete, starting tests!');
    }, 30000);

    describe('Scenario 1: Event Service produces to Kafka', () => {
        it('Given an event service, when I send a message, then I consume an event from Kafka', async () => {
            // Use unique event name for this test run
            const eventName = `bdd_test_1_${TEST_RUN_ID}`;
            const correlationId = crypto.randomUUID();

            // GIVEN: A Kafka consumer listening to the raw events topic (only new messages)
            const consumer = kafka.consumer({ groupId: `bdd-test-1-${Date.now()}` });
            await consumer.connect();
            await consumer.subscribe({
                topic: 'events.events_development.event',
                fromBeginning: false  // Only read new messages from this test run
            });

            let receivedEvent: any = null;
            const eventPromise = new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Timeout waiting for event in Kafka')), 30000);

                consumer.run({
                    eachMessage: async ({ topic, partition, message }) => {
                        try {
                            const value = JSON.parse(message.value?.toString('utf8') || '{}');
                            const afterString = value?.payload?.after || value?.after;
                            if (!afterString) return;

                            const afterDoc = typeof afterString === 'string' ? JSON.parse(afterString) : afterString;
                            const eventData = afterDoc?.payload || afterDoc;

                            console.log(`Scenario 1: Received event - name: ${eventData?.name}`);

                            if (eventData?.name === eventName) {
                                receivedEvent = eventData;
                                clearTimeout(timeout);
                                resolve();
                                consumer.disconnect().catch(() => {});
                            }
                        } catch (err) {
                            console.error('Scenario 1: Error parsing message:', err);
                        }
                    }
                });
            });

            // Wait for consumer to be ready
            await new Promise(resolve => setTimeout(resolve, 2000));

            // WHEN: I post an event to the event service
            const response = await raw_event_api.create(null, {
                name: eventName,
                correlationId: correlationId,
                data: JSON.stringify({ test: 'scenario_1', timestamp: Date.now() }),
                timestamp: new Date().toISOString(),
                source: 'bdd_test',
                version: '1.0'
            });

            const eventId = response.request.path.slice(-36);
            console.log(`Scenario 1: Created event ${eventId}`);

            // THEN: I should receive the event from Kafka
            await eventPromise;

            expect(receivedEvent).toBeDefined();
            expect(receivedEvent.name).toBe(eventName);
            expect(receivedEvent.correlationId).toBe(correlationId);
            expect(receivedEvent.source).toBe('bdd_test');
        }, 45000);
    });

    describe('Scenario 2: Processed Event Service receives messages', () => {
        it('Given a processed event service, when I send a message, then it appears in Kafka', async () => {
            // Use unique event name for this test run
            const processedEventName = `bdd_test_2_${TEST_RUN_ID}`;
            const rawEventId = crypto.randomUUID();
            const correlationId = crypto.randomUUID();

            // GIVEN: A Kafka consumer listening to processed events (only new messages)
            const consumer = kafka.consumer({ groupId: `bdd-test-2-${Date.now()}` });
            await consumer.connect();
            await consumer.subscribe({
                topic: 'events.events_development.processedevent',
                fromBeginning: false  // Only read new messages from this test run
            });

            let receivedEvent: any = null;
            const eventPromise = new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Timeout waiting for processed event in Kafka')), 30000);

                consumer.run({
                    eachMessage: async ({ message }) => {
                        try {
                            const value = JSON.parse(message.value?.toString('utf8') || '{}');
                            const afterString = value?.payload?.after || value?.after;
                            if (!afterString) return;

                            const afterDoc = typeof afterString === 'string' ? JSON.parse(afterString) : afterString;
                            const eventData = afterDoc?.payload || afterDoc;

                            console.log(`Scenario 2: Received event - name: ${eventData?.name}`);

                            if (eventData?.name === processedEventName) {
                                receivedEvent = eventData;
                                clearTimeout(timeout);
                                resolve();
                                consumer.disconnect().catch(() => {});
                            }
                        } catch (err) {
                            console.error('Scenario 2: Error parsing message:', err);
                        }
                    }
                });
            });

            // Wait for consumer to be ready
            await new Promise(resolve => setTimeout(resolve, 2000));

            // WHEN: I post a processed event directly to the API
            await processed_event_api.create(null, {
                id: crypto.randomUUID(),
                raw_event_id: rawEventId,
                name: processedEventName,
                correlationId: correlationId,
                processed_data: JSON.stringify({ test: 'scenario_2', enriched: true }),
                processed_timestamp: new Date().toISOString(),
                processing_time_ms: 42,
                status: 'SUCCESS'
            });

            console.log(`Scenario 2: Created processed event for raw_event_id ${rawEventId}`);

            // THEN: It should appear in Kafka via CDC
            await eventPromise;

            expect(receivedEvent).toBeDefined();
            expect(receivedEvent.name).toBe(processedEventName);
            expect(receivedEvent.correlationId).toBe(correlationId);
            expect(receivedEvent.status).toBe('SUCCESS');
        }, 45000);
    });

    describe('Scenario 3: Processor consumes from Kafka and calls API', () => {
        it('Given a processor, when an event appears in Kafka, then it creates a processed event', async () => {
            // Use unique event name for this test run
            const eventName = `bdd_test_3_${TEST_RUN_ID}`;
            const correlationId = crypto.randomUUID();

            // GIVEN: A Kafka consumer listening to processed events topic (only new messages)
            const consumer = kafka.consumer({ groupId: `bdd-test-3-${Date.now()}` });
            await consumer.connect();
            await consumer.subscribe({
                topic: 'events.events_development.processedevent',
                fromBeginning: false  // Only read new messages from this test run
            });

            let receivedProcessedEvent: any = null;
            const processedEventPromise = new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Timeout waiting for processed event in Kafka'));
                }, 30000);

                consumer.run({
                    eachMessage: async ({ message }) => {
                        try {
                            const value = JSON.parse(message.value?.toString('utf8') || '{}');
                            const afterString = value?.payload?.after || value?.after;
                            if (!afterString) return;

                            const afterDoc = typeof afterString === 'string' ? JSON.parse(afterString) : afterString;
                            const eventData = afterDoc?.payload || afterDoc;

                            console.log(`Scenario 3: Received processed event - name: ${eventData?.name}`);

                            if (eventData?.name === eventName) {
                                receivedProcessedEvent = eventData;
                                clearTimeout(timeout);
                                resolve();
                                consumer.disconnect().catch(() => {});
                            }
                        } catch (err) {
                            console.error('Scenario 3: Error processing message:', err);
                        }
                    }
                });
            });

            // Wait for consumer and processor to be ready
            await new Promise(resolve => setTimeout(resolve, 2000));

            // WHEN: I post a raw event (which the processor should pick up)
            const response = await raw_event_api.create(null, {
                name: eventName,
                correlationId: correlationId,
                data: JSON.stringify({ test: 'scenario_3', user_id: 'user999' }),
                timestamp: new Date().toISOString(),
                source: 'bdd_test',
                version: '1.0'
            });

            const rawEventId = response.request.path.slice(-36);
            console.log(`Scenario 3: Created raw event ${rawEventId}`);

            // THEN: The processor should consume it and create a processed event
            await processedEventPromise;

            expect(receivedProcessedEvent).toBeDefined();
            expect(receivedProcessedEvent.name).toBe(eventName);
            expect(receivedProcessedEvent.correlationId).toBe(correlationId);
            expect(receivedProcessedEvent.status).toBe('SUCCESS');
            expect(receivedProcessedEvent.raw_event_id).toBeDefined();
        }, 45000);
    });

    describe('Scenario 4: Full End-to-End Flow', () => {
        it('Given event service AND processed event service AND processor, when I post an event, then I receive a processed event', async () => {
            // Use unique event name for this test run
            const eventName = `bdd_test_4_${TEST_RUN_ID}`;
            const correlationId = crypto.randomUUID();

            // GIVEN: All services are running and a consumer is listening (only new messages)
            const consumer = kafka.consumer({ groupId: `bdd-test-4-${Date.now()}` });
            await consumer.connect();
            await consumer.subscribe({
                topic: 'events.events_development.processedevent',
                fromBeginning: false  // Only read new messages from this test run
            });

            let rawEventId = '';
            let processedEvent: any = null;

            const processedEventPromise = new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error(`Timeout waiting for processed event. Raw event ID: ${rawEventId}`));
                }, 30000);

                consumer.run({
                    eachMessage: async ({ message }) => {
                        try {
                            const value = JSON.parse(message.value?.toString('utf8') || '{}');
                            const afterString = value?.payload?.after || value?.after;
                            if (!afterString) return;

                            const afterDoc = typeof afterString === 'string' ? JSON.parse(afterString) : afterString;
                            const eventData = afterDoc?.payload || afterDoc;

                            console.log(`Scenario 4: Received event - name: ${eventData?.name}, raw_event_id: ${eventData?.raw_event_id}, looking for: ${rawEventId}`);

                            if (eventData?.raw_event_id === rawEventId && eventData?.name === eventName) {
                                processedEvent = eventData;
                                clearTimeout(timeout);
                                resolve();
                                consumer.disconnect().catch(() => {});
                            }
                        } catch (err) {
                            console.error('Scenario 4: Error:', err);
                        }
                    }
                });
            });

            // Wait for consumer and all services to be ready
            await new Promise(resolve => setTimeout(resolve, 3000));

            // WHEN: I post a raw event
            const response = await raw_event_api.create(null, {
                name: eventName,
                correlationId: correlationId,
                data: JSON.stringify({
                    test: 'scenario_4_full_e2e',
                    user_id: 'user_e2e',
                    username: 'test_user',
                    action: 'login'
                }),
                timestamp: new Date().toISOString(),
                source: 'bdd_test_e2e',
                version: '1.0'
            });

            rawEventId = response.request.path.slice(-36);
            console.log(`Scenario 4: Created raw event ${rawEventId}, waiting for processed event...`);

            // THEN: The full pipeline should work end-to-end
            await processedEventPromise;

            expect(processedEvent).toBeDefined();
            expect(processedEvent.name).toBe(eventName);
            expect(processedEvent.correlationId).toBe(correlationId);
            expect(processedEvent.status).toBe('SUCCESS');
            expect(processedEvent.raw_event_id).toBe(rawEventId);
            expect(processedEvent.processing_time_ms).toBeGreaterThan(0);

            // Verify enrichment happened
            const processedData = JSON.parse(processedEvent.processed_data);
            expect(processedData.user_id).toBe('user_e2e');
            expect(processedData.username).toBe('test_user');
            expect(processedData.enriched).toBe(true);

            console.log(`Scenario 4: SUCCESS - Full E2E flow completed in pipeline`);
        }, 45000);
    });
});

async function getSwaggerDocs() {
    return await Promise.all(
        ['/event', '/processedevent'].map(async (restlette) => {
            // Events service is exposed on NodePort 30033, mapped to host port 3033
            let url = `http://localhost:3033${restlette}/api/api-docs/swagger.json`;
            const response = await fetch(url);
            return await response.json();
        }),
    );
}

async function buildApi(swagger_docs: Document[]) {
    const apis: OpenAPIClient[] = await Promise.all(
        swagger_docs.map(async (doc: Document): Promise<OpenAPIClient> => {
            if (!doc.paths || Object.keys(doc.paths).length === 0) {
                throw new Error(`Swagger document for ${doc.info.title} has no paths defined`);
            }

            // Override baseURL to use NodePort mapping instead of internal cluster URL
            const api = new OpenAPIClientAxios({
                definition: doc,
                withServer: { url: 'http://localhost:3033' }
            });

            return api.init();
        }),
    );

    for (const api of apis) {
        const firstPath = Object.keys(api.paths)[0];
        if (firstPath.includes('event') && !firstPath.includes('processedevent')) {
            raw_event_api = api;
        } else if (firstPath.includes('processedevent')) {
            processed_event_api = api;
        }
    }
}
