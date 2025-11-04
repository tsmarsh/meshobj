import { DockerComposeEnvironment, StartedDockerComposeEnvironment, Wait } from 'testcontainers';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import { Kafka } from 'kafkajs';
import { Document, OpenAPIClient, OpenAPIClientAxios } from 'openapi-client-axios';

let environment: StartedDockerComposeEnvironment;
let raw_event_api: any;
let processed_event_api: any;
let kafka: Kafka;

// Skipped for CI - takes 60+ seconds to spin up full CDC stack (MongoDB, Kafka, Debezium)
// Run manually with: yarn test test/events.bdd.ts
// Automatically skipped in CI environments (when CI=true)
describe.skipIf(process.env.CI === 'true')('Events Service BDD Tests', () => {
    beforeAll(async () => {
        // Start the docker-compose environment
        environment = await new DockerComposeEnvironment(path.resolve(__dirname, '../generated'), 'docker-compose.yml')
            .withBuild()
            .withWaitStrategy('events-1', Wait.forHttp('/ready', 4055).withStartupTimeout(120000))
            .up();

        console.log('Docker Compose environment started successfully');

        // Initialize Kafka client (use host listener)
        kafka = new Kafka({
            clientId: 'events-bdd-test',
            brokers: ['localhost:9092']
        });

        // Test Kafka connection
        const admin = kafka.admin();
        try {
            await admin.connect();
            console.log('Kafka admin connected successfully');
            const topics = await admin.listTopics();
            console.log(`Existing Kafka topics: ${topics.join(', ')}`);
            await admin.disconnect();
        } catch (err) {
            console.error('Failed to connect to Kafka admin:', err);
        }

        // Test producer
        const producer = kafka.producer();
        try {
            await producer.connect();
            console.log('Kafka producer connected successfully');
            await producer.send({
                topic: 'test-topic',
                messages: [{ value: 'test message' }]
            });
            console.log('Successfully sent test message to Kafka');
            await producer.disconnect();
        } catch (err) {
            console.error('Failed to produce to Kafka:', err);
        }

        // Test consumer
        const testConsumer = kafka.consumer({ groupId: 'connection-test' });
        try {
            await testConsumer.connect();
            console.log('Kafka consumer connected successfully');
            await testConsumer.subscribe({ topic: 'test-topic' });
            console.log('Consumer subscribed to test-topic');
           await testConsumer.disconnect();
        } catch (err) {
            console.error('Failed to consume from Kafka:', err);
        }

        // Build API clients
        const swagger_docs: Document[] = await getSwaggerDocs();
        await buildApi(swagger_docs);

        console.log('APIs initialized, waiting for Debezium and processor to be ready...');
        // Collections and topics are pre-created by docker-compose init containers
        // Wait for Debezium to complete snapshot and processor to start consuming
        await new Promise(resolve => setTimeout(resolve, 20000));
        console.log('Setup complete, starting tests!');
    }, 300000);

    afterAll(async () => {
        if (environment) {
            await environment.down();
        }
    });

    describe('Scenario 1: Event Service produces to Kafka', () => {
        it('Given an event service, when I send a message, then I consume an event from Kafka', async () => {
            // GIVEN: A Kafka consumer listening to the raw events topic
            const consumer = kafka.consumer({ groupId: `bdd-test-1-${Date.now()}` });
            await consumer.connect();
            await consumer.subscribe({
                topic: 'events.events_development.event',
                fromBeginning: true  // Read from beginning to catch all messages
            });

            let receivedEvent: any = null;
            const eventPromise = new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Timeout waiting for event in Kafka')), 45000);

                consumer.run({
                    eachMessage: async ({ topic, partition, message }) => {
                        try {
                            const value = JSON.parse(message.value?.toString('utf8') || '{}');
                            // Debezium wraps the document: payload.after is a JSON string
                            const afterString = value?.payload?.after || value?.after;
                            if (!afterString) {
                                console.log(`Scenario 1: Skipping message from ${topic}, no after field`);
                                return;
                            }

                            const afterDoc = typeof afterString === 'string' ? JSON.parse(afterString) : afterString;
                            // The actual event data is in afterDoc.payload
                            const eventData = afterDoc?.payload || afterDoc;

                            console.log(`Scenario 1: Received event from ${topic} - name: ${eventData?.name}, full eventData:`, JSON.stringify(eventData).substring(0, 200));

                            if (eventData?.name === 'bdd_test_1') {
                                console.log('Scenario 1: MATCH FOUND! Resolving...');

                                receivedEvent = eventData;
                                clearTimeout(timeout);
                                resolve();
                                // Disconnect after resolving (don't await)
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
            const eventName = 'bdd_test_1';
            const correlationId = crypto.randomUUID();
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
        }, 60000); // Keep 60s for Scenario 1 as it's the first test
    });

    describe('Scenario 2: Processed Event Service receives messages', () => {
        it('Given a processed event service, when I send a message, then it appears in Kafka', async () => {
            // GIVEN: A Kafka consumer listening to processed events
            const consumer = kafka.consumer({ groupId: `bdd-test-2-${Date.now()}` });
            await consumer.connect();
            await consumer.subscribe({
                topic: 'events.events_development.processedevent',
                fromBeginning: true  // Read from beginning to catch all messages
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

                            if (eventData?.name === 'bdd_test_2') {
                                receivedEvent = eventData;
                                clearTimeout(timeout);
                                resolve();
                                // Disconnect after resolving (don't await)
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
            const processedEventName = 'bdd_test_2';
            const rawEventId = crypto.randomUUID();
            const correlationId = crypto.randomUUID();

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
            // GIVEN: A Kafka consumer listening to processed events topic
            const consumer = kafka.consumer({ groupId: `bdd-test-3-${Date.now()}` });
            await consumer.connect();
            await consumer.subscribe({
                topic: 'events.events_development.processedevent',
                fromBeginning: true  // Read from beginning to catch all messages
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

                            console.log(`Scenario 3: Received processed event - name: ${eventData?.name}, raw_event_id: ${eventData?.raw_event_id}`);

                            if (eventData?.name === 'bdd_test_3') {
                                receivedProcessedEvent = eventData;
                                clearTimeout(timeout);
                                resolve();
                                // Disconnect after resolving (don't await)
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
            const eventName = 'bdd_test_3';
            const correlationId = crypto.randomUUID();
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
            // GIVEN: All services are running and a consumer is listening
            const consumer = kafka.consumer({ groupId: `bdd-test-4-${Date.now()}` });
            await consumer.connect();
            await consumer.subscribe({
                topic: 'events.events_development.processedevent',
                fromBeginning: true  // Read from beginning to catch all messages
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

                            if (eventData?.raw_event_id === rawEventId && eventData?.name === 'bdd_test_4') {
                                processedEvent = eventData;
                                clearTimeout(timeout);
                                resolve();
                                // Disconnect after resolving (don't await)
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
            const eventName = 'bdd_test_4';
            const correlationId = crypto.randomUUID();
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
            let url = `http://localhost:4055${restlette}/api/api-docs/swagger.json`;
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

            const api = new OpenAPIClientAxios({
                definition: doc,
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
