import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoDBContainer } from '@testcontainers/mongodb';
import { GenericContainer, Wait, Network } from 'testcontainers';
import { Kafka } from 'kafkajs';
import { MongoClient } from 'mongodb';

let network: Network;
let zookeeperContainer: any;
let kafkaContainer: any;
let mongoContainer: any;
let debeziumContainer: any;
let kafka: Kafka;
let mongoClient: MongoClient;

describe('MongoDB + Debezium + Kafka CDC Pipeline', () => {
    beforeAll(async () => {
        console.log('Step 0: Creating shared network...');
        network = await new Network().start();
        console.log('✓ Network created');

        console.log('Step 1: Starting ZooKeeper...');
        zookeeperContainer = await new GenericContainer('confluentinc/cp-zookeeper:7.5.0')
            .withNetwork(network)
            .withNetworkAliases('zookeeper')
            .withEnvironment({
                'ZOOKEEPER_CLIENT_PORT': '2181',
                'ZOOKEEPER_TICK_TIME': '2000'
            })
            .withExposedPorts(2181)
            .start();
        console.log('✓ ZooKeeper started');

        console.log('Step 2: Starting Kafka...');
        kafkaContainer = await new GenericContainer('confluentinc/cp-kafka:7.5.0')
            .withNetwork(network)
            .withNetworkAliases('kafka')
            .withEnvironment({
                'KAFKA_BROKER_ID': '1',
                'KAFKA_ZOOKEEPER_CONNECT': 'zookeeper:2181',
                'KAFKA_ADVERTISED_LISTENERS': 'INTERNAL://kafka:9093,EXTERNAL://localhost:9092',
                'KAFKA_LISTENERS': 'INTERNAL://0.0.0.0:9093,EXTERNAL://0.0.0.0:9092',
                'KAFKA_LISTENER_SECURITY_PROTOCOL_MAP': 'INTERNAL:PLAINTEXT,EXTERNAL:PLAINTEXT',
                'KAFKA_INTER_BROKER_LISTENER_NAME': 'INTERNAL',
                'KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR': '1',
                'KAFKA_TRANSACTION_STATE_LOG_MIN_ISR': '1',
                'KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR': '1'
            })
            .withExposedPorts(9092, 9093)
            .withStartupTimeout(120000)
            .start();
        const kafkaHost = kafkaContainer.getHost();
        const kafkaPort = kafkaContainer.getMappedPort(9092);
        const kafkaBroker = `${kafkaHost}:${kafkaPort}`;
        console.log(`✓ Kafka running on: ${kafkaBroker}`);

        console.log('Step 3: Starting MongoDB with replica set...');
        mongoContainer = await new MongoDBContainer('mongo:8')
            .withNetwork(network)
            .withNetworkAliases('mongodb')
            .withCommand(['--replSet', 'rs0'])
            .start();

        const mongoHost = mongoContainer.getHost();
        const mongoPort = mongoContainer.getMappedPort(27017);
        const mongoUri = `mongodb://${mongoHost}:${mongoPort}/?directConnection=true`;
        console.log(`✓ MongoDB running on: ${mongoUri}`);

        // Initialize replica set
        mongoClient = new MongoClient(mongoUri);
        await mongoClient.connect();
        const admin = mongoClient.db('admin');

        // Initialize replica set with network alias
        try {
            await admin.command({
                replSetInitiate: {
                    _id: 'rs0',
                    members: [{ _id: 0, host: 'mongodb:27017' }]
                }
            });
            console.log('✓ Replica set initialized');
        } catch (err: any) {
            if (!err.message.includes('already initialized')) {
                throw err;
            }
            console.log('✓ Replica set already initialized');
        }

        // Wait for replica set to be ready
        await new Promise(resolve => setTimeout(resolve, 5000));

        console.log('Step 4: Starting Debezium...');

        // Get container network addresses
        const mongoNetworkAlias = 'mongodb';
        const kafkaNetworkAlias = 'kafka';

        // Create Debezium configuration using container hostnames
        const debeziumConfig = `
debezium.source.connector.class=io.debezium.connector.mongodb.MongoDbConnector
debezium.source.mongodb.connection.string=mongodb://${mongoNetworkAlias}:27017/?replicaSet=rs0
debezium.source.topic.prefix=testdb
debezium.source.capture.mode=change_streams
debezium.source.collection.include.list=testdb.events
debezium.source.mongodb.change.stream.full.document=updateLookup

debezium.sink.type=kafka
debezium.sink.kafka.producer.bootstrap.servers=${kafkaNetworkAlias}:9093
debezium.sink.kafka.producer.key.serializer=org.apache.kafka.common.serialization.StringSerializer
debezium.sink.kafka.producer.value.serializer=org.apache.kafka.common.serialization.StringSerializer

debezium.format.key=json
debezium.format.value=json

debezium.source.offset.storage=org.apache.kafka.connect.storage.FileOffsetBackingStore
debezium.source.offset.storage.file.filename=/tmp/offsets.dat
debezium.source.offset.flush.interval.ms=1000
        `.trim();

        debeziumContainer = await new GenericContainer('quay.io/debezium/server:2.6')
            .withNetwork(network)
            .withCommand(['bash', '-c', `
                cat > /debezium/conf/application.properties << 'EOFCONFIG'
${debeziumConfig}
EOFCONFIG
                cat /debezium/conf/application.properties
                /debezium/run.sh
            `])
            .withStartupTimeout(120000)
            .start();

        console.log('✓ Debezium started');

        // Wait for Debezium to fully initialize and process initial snapshot
        await new Promise(resolve => setTimeout(resolve, 15000));

        // Initialize Kafka client
        kafka = new Kafka({
            clientId: 'cdc-test-client',
            brokers: [kafkaBroker]
        });

        console.log('✓ All containers ready!');
    }, 180000);

    afterAll(async () => {
        if (mongoClient) await mongoClient.close();
        if (debeziumContainer) await debeziumContainer.stop();
        if (mongoContainer) await mongoContainer.stop();
        if (kafkaContainer) await kafkaContainer.stop();
        if (zookeeperContainer) await zookeeperContainer.stop();
        if (network) await network.stop();
    });

    it('should capture MongoDB change and publish to Kafka', async () => {
        const topic = 'testdb.testdb.events';
        const db = mongoClient.db('testdb');
        const collection = db.collection('events');

        // Set up Kafka consumer
        const consumer = kafka.consumer({ groupId: 'cdc-test-group' });
        await consumer.connect();
        await consumer.subscribe({ topic, fromBeginning: true });
        console.log(`Consumer subscribed to: ${topic}`);

        // Set up message reception
        const receivedMessages: any[] = [];
        const messagePromise = new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout waiting for CDC message'));
            }, 15000);

            consumer.run({
                eachMessage: async ({ message }) => {
                    const value = message.value?.toString();
                    console.log(`Received CDC message: ${value?.substring(0, 200)}...`);
                    receivedMessages.push(JSON.parse(value || '{}'));
                    clearTimeout(timeout);
                    resolve();
                }
            });
        });

        // Wait for consumer to be ready
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Write to MongoDB
        const testDoc = {
            name: 'test_event',
            data: { test: 'cdc_pipeline', timestamp: Date.now() },
            source: 'test'
        };
        console.log('Inserting document into MongoDB...');
        const result = await collection.insertOne(testDoc);
        console.log(`✓ Document inserted with ID: ${result.insertedId}`);

        // Wait for CDC message
        await messagePromise;

        // Cleanup
        await consumer.disconnect();

        // Assert
        expect(receivedMessages.length).toBeGreaterThan(0);
        const cdcMessage = receivedMessages[0];

        // Debezium wraps the document
        const payload = cdcMessage.payload || cdcMessage;
        expect(payload.after || payload).toBeDefined();

        console.log('✅ CDC pipeline works! MongoDB → Debezium → Kafka');
    }, 30000);
});
