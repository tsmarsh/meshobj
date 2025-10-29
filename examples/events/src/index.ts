#!/usr/bin/env node
// Main entry point - starts both the MeshQL server and the Kafka processor

import { init } from '@meshobj/server';
import { configureLogging, getLogger } from '@meshobj/common';
import { MongoPlugin } from '@meshobj/mongo_repo';
import { RawToProcessedProcessor } from './processor.js';
import * as path from 'path';
import * as fs from 'fs';

configureLogging('info');
const log = getLogger('events/index');

// Load the generated server config
const configPath = path.join(__dirname, '../generated/events/server-config.json');
let config: any;

if (fs.existsSync(configPath)) {
  // If the deployment generated a JSON config, use it
  config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
} else {
  // Otherwise use inline config (for the generated server.ts case)
  const port = parseInt(process.env.PORT || '4055');
  const mongoUri = process.env.MONGO_URI || 'mongodb://mongodb:27017/events_db?replicaSet=rs0';
  const prefix = process.env.PREFIX || 'events';
  const env = process.env.ENV || 'development';
  const db = `${prefix}_${env}`;

  config = {
    port,
    graphlettes: [
      {
        path: '/event/graph',
        storage: {
          type: 'mongo',
          uri: mongoUri,
          db,
          collection: 'event',
          options: {}
        },
        schema: `scalar Date

type Query {
  getByName(name: String, at: Float): [Event]
  getById(id: ID, at: Float): Event
}

type Event {
  id: ID
  name: String!
  data: String!
  source: String
  version: String
  timestamp: Date!
  processedEvents: [ProcessedEvent]
}

type ProcessedEvent {
  id: ID!
  raw_event: String!
  name: String!
  processed_data: String!
  processed_timestamp: Date!
  processing_time_ms: Float
  status: ProcessingStatus!
  error_message: String
}

enum ProcessingStatus {
  SUCCESS
  FAILED
  PARTIAL
}
`,
        rootConfig: {
          singletons: [
            { name: 'getById', query: 'findOne', id: '_id' },
          ],
          vectors: [
            { name: 'getByName', query: 'find' },
          ],
        }
      },
      {
        path: '/processedevent/graph',
        storage: {
          type: 'mongo',
          uri: mongoUri,
          db,
          collection: 'processedevent',
          options: {}
        },
        schema: `scalar Date

type Event {
  id: ID
  name: String!
  data: String!
  source: String
  version: String
  timestamp: Date!
}

type Query {
  getByName(name: String, at: Float): [ProcessedEvent]
  getById(id: ID, at: Float): ProcessedEvent
  getByEvent(id: ID, at: Float): [ProcessedEvent]
}

type ProcessedEvent {
  id: ID!
  raw_event: String!
  name: String!
  processed_data: String!
  processed_timestamp: Date!
  processing_time_ms: Float
  status: ProcessingStatus!
  error_message: String
}

enum ProcessingStatus {
  SUCCESS
  FAILED
  PARTIAL
}
`,
        rootConfig: {
          singletons: [
            { name: 'getById', query: 'findOne', id: '_id' },
          ],
          vectors: [
            { name: 'getByName', query: 'find' },
            { name: 'getByEvent', query: 'find' },
          ],
        }
      },
    ],
    restlettes: [
      {
        path: '/event/api',
        storage: {
          type: 'mongo',
          uri: mongoUri,
          db,
          collection: 'event',
          options: {}
        },
        schema: {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "name",
            "data",
            "timestamp"
          ],
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid"
            },
            "name": {
              "type": "string"
            },
            "data": {
              "type": "string"
            },
            "source": {
              "type": "string"
            },
            "version": {
              "type": "string"
            },
            "timestamp": {
              "type": "string",
              "format": "date-time"
            }
          }
        }
      },
      {
        path: '/processedevent/api',
        storage: {
          type: 'mongo',
          uri: mongoUri,
          db,
          collection: 'processedevent',
          options: {}
        },
        schema: {
          "type": "object",
          "additionalProperties": false,
          "required": [
            "id",
            "raw_event_id",
            "name",
            "processed_data",
            "processed_timestamp",
            "status"
          ],
          "properties": {
            "id": {
              "type": "string",
              "format": "uuid"
            },
            "raw_event_id": {
              "type": "string",
              "format": "uuid"
            },
            "name": {
              "type": "string"
            },
            "processed_data": {
              "type": "string"
            },
            "processed_timestamp": {
              "type": "string",
              "format": "date-time"
            },
            "processing_time_ms": {
              "type": "number"
            },
            "status": {
              "type": "string",
              "enum": ["SUCCESS", "FAILED", "PARTIAL"]
            },
            "error_message": {
              "type": "string"
            }
          }
        }
      },
    ]
  };
}

const plugins = {
  mongo: new MongoPlugin(),
};

async function main() {
  // Start the MeshQL server
  const app = await init(config, plugins);

  app.listen(config.port, () => {
    log.info(`Server running on port ${config.port}`);
  });

  // Start the Kafka processor
  const rawTopic = process.env.RAW_TOPIC || 'events.events_db.raw_events';
  process.env.RAW_TOPIC = rawTopic;
  process.env.KAFKA_BROKER = process.env.KAFKA_BROKER || 'redpanda:9092';
  process.env.PROCESSED_API_BASE = process.env.PROCESSED_API_BASE || `http://localhost:${config.port}/processedevent/api`;

  const processor = new RawToProcessedProcessor();
  await processor.start();
  log.info(`Processor started, consuming from ${rawTopic}`);

  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    log.info('SIGTERM received, shutting down gracefully');
    await processor.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    log.info('SIGINT received, shutting down gracefully');
    await processor.stop();
    process.exit(0);
  });
}

main().catch(err => {
  log.error('Failed to start:', err);
  process.exit(1);
});
