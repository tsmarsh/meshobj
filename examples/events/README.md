# Events Example: CDC-Powered Event Processing Pipeline

This example demonstrates how to build a **trivial yet performant** event processing pipeline using Change Data Capture (CDC) infrastructure. It showcases how adding a "processor" to an event-driven architecture requires minimal code while leveraging proven CDC technology (Debezium + Kafka/Redpanda).

## What We're Demonstrating

The key insight: **You don't need to build event processing infrastructure from scratch.** By using CDC, you can:

1. Write events to MongoDB using a simple REST API
2. Automatically stream changes to Kafka via Debezium
3. Process events with minimal custom code
4. Stream processed results back through the same CDC pipeline
5. Query both raw and processed events via GraphQL

**The processor itself is ~100 lines of code.** All the heavy lifting (reliability, ordering, backpressure, monitoring) is handled by battle-tested CDC infrastructure.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Event Processing Flow                        │
└─────────────────────────────────────────────────────────────────────┘

1. Write Event (REST API)
   Client → POST /event/api → MongoDB (raw_events collection)
                                  │
                                  ├─ GraphQL: /event/graph
                                  │
2. CDC Capture (Debezium)         ▼
   Debezium monitors MongoDB → Change Stream → Kafka Topic
                               (rs0 replica set)    (events.events_development.event)
                                                     │
3. Process Event (Custom Processor)                 │
   Kafka Consumer ◄─────────────────────────────────┘
        │
        ├─ Parse Debezium envelope
        ├─ Transform data (enrich, validate, aggregate)
        │
        └─ POST /processedevent/api → MongoDB (processedevent collection)
                                           │
                                           ├─ GraphQL: /processedevent/graph
                                           │
4. CDC Capture (Debezium again)           ▼
   Debezium monitors MongoDB → Change Stream → Kafka Topic
                                                (events.events_development.processedevent)
                                                     │
5. Verify Results                                   │
   Test Consumer ◄──────────────────────────────────┘
   (proves end-to-end CDC pipeline works)
```

## Key Components

### Services

- **MongoDB (Replica Set)**: Stores both raw and processed events
- **Redpanda**: Kafka-compatible message broker (lightweight alternative)
- **Debezium Server**: CDC connector that captures MongoDB changes
- **Events Service**: MeshQL server providing REST + GraphQL APIs
- **Processor**: Custom Node.js consumer that processes events

### APIs

#### REST Endpoints
- `POST /event/api` - Create raw events
- `GET /event/api/:id` - Retrieve raw event
- `POST /processedevent/api` - Create processed events (used by processor)
- `GET /processedevent/api/:id` - Retrieve processed event

#### GraphQL Endpoints
- `/event/graph` - Query raw events
  - `getById(id: ID)` - Single event
  - `getByName(name: String)` - Events by name

- `/processedevent/graph` - Query processed events
  - `getById(id: ID)` - Single processed event
  - `getByName(name: String)` - Processed events by name
  - `getByRawEventId(raw_event_id: String)` - Find processing results

### Data Flow Example

```typescript
// 1. Create a raw event
POST /event/api
{
  "name": "user_login",
  "data": "{\"user_id\":\"user123\",\"username\":\"john_doe\"}",
  "timestamp": "2025-01-15T10:30:00Z",
  "source": "auth_service",
  "version": "1.0"
}

// 2. Debezium captures change → Kafka (automatic)
// Topic: events.events_development.event
// Message: { op: 'c', after: { _id: '...', name: 'user_login', ... } }

// 3. Processor consumes, transforms, and writes (automatic)
// Processor reads from Kafka, processes, then:
POST /processedevent/api
{
  "id": "new-uuid",
  "raw_event_id": "original-event-id",
  "name": "user_login",
  "processed_data": "{\"user_id\":\"user123\",\"enriched\":true}",
  "processed_timestamp": "2025-01-15T10:30:01Z",
  "processing_time_ms": 42,
  "status": "SUCCESS"
}

// 4. Debezium captures processed event → Kafka (automatic)
// Topic: events.events_development.processedevent

// 5. Query processed results
GET /processedevent/graph
{
  getByRawEventId(raw_event_id: "original-event-id") {
    id
    name
    status
    processing_time_ms
  }
}
```

## Why This Approach is Trivial and Performant

### Trivial (Low Complexity)

1. **No custom queue management**: Kafka handles all the hard parts
   - Message ordering
   - Persistence
   - Backpressure
   - Consumer groups
   - Offset management

2. **Minimal processor code**: See `src/processor.ts` (~100 lines)
   - Subscribe to Kafka topic
   - Parse Debezium envelope
   - Transform data
   - POST to API

3. **No database polling**: CDC automatically captures changes
   - No need for "processed" flags
   - No need for cron jobs
   - No missing changes

4. **Standard APIs**: Just REST + GraphQL via MeshQL
   - No custom event bus to maintain
   - No special event publishing code
   - Standard HTTP/GraphQL tooling works

### Performant

1. **Kafka is battle-tested**: Handles millions of events/sec
2. **CDC is real-time**: Sub-second latency from write to Kafka
3. **Horizontal scaling**: Add more processor instances trivially
4. **Exactly-once semantics**: Debezium + Kafka provide guarantees
5. **Asynchronous**: Writing event returns immediately, processing happens in background

## Setup and Usage

### Prerequisites

- Docker and Docker Compose
- Node.js 18+
- Yarn

### Running the Example

```bash
# From the monorepo root
yarn install
yarn build

# Start the services
cd examples/events/generated
docker-compose up --build

# Services will be available at:
# - Events API: http://localhost:4055
# - MongoDB: localhost:27017
# - Redpanda: localhost:9092
# - Redpanda Console: http://localhost:8082
```

### Running the Tests

The integration test proves the entire CDC pipeline works end-to-end by:

1. Starting all services (MongoDB, Redpanda, Debezium, Events service)
2. Subscribing to the processed events Kafka topic
3. Creating a raw event via REST API
4. Waiting for the processed event to appear in Kafka
5. Verifying the processing results

```bash
# From examples/events
yarn test
```

The test uses testcontainers to ensure complete isolation and reproducibility.

## Configuration Files

### `debezium/application.properties`

Configures Debezium Server to:
- Monitor MongoDB replica set `rs0`
- Watch collections: `events_development.event` and `events_development.processedevent`
- Publish changes to Redpanda topics
- Use file-based offset storage for development

Key settings:
```properties
debezium.source.connector.class=io.debezium.connector.mongodb.MongoDbConnector
debezium.source.mongodb.connection.string=mongodb://mongodb:27017/?replicaSet=rs0
debezium.source.database.include.list=events_development
debezium.source.collection.include.list=events_development.event,events_development.processedevent
debezium.sink.type=kafka
debezium.sink.kafka.producer.bootstrap.servers=redpanda:9092
```

### `generated/docker-compose.yml`

Orchestrates all services with proper health checks and dependencies:

1. **MongoDB**: Started first with replica set
2. **mongo-init-replica**: Initializes replica set (required for CDC)
3. **Redpanda**: Kafka-compatible broker
4. **Debezium**: Starts after MongoDB replica set is ready
5. **Events Service**: Starts after all dependencies are healthy

### `src/index.ts`

Main entry point that:
- Initializes MeshQL server with graphlettes and restlettes
- Starts the Kafka processor
- Handles graceful shutdown

### `src/processor.ts`

The event processor that:
- Consumes from `events.events_development.event` topic
- Filters for insert/create operations
- Extracts the `after` document from Debezium envelope
- Transforms/enriches the data
- Posts processed event to `/processedevent/api`

## Comparison with Traditional Approaches

### Without CDC

```typescript
// Traditional approach: Manual event publishing
async function createEvent(event) {
  // 1. Write to database
  const saved = await db.events.insert(event);

  // 2. Publish to queue (easy to forget, can fail silently)
  await queue.publish('raw-events', saved);

  // 3. What if queue publish fails? Need retry logic, dead letter queues...
  // 4. What if there's a bug and some code path doesn't publish?
  // 5. What about backfilling? Need separate scripts...
}
```

Problems:
- Dual-write problem (database + queue can get out of sync)
- Easy to forget to publish in some code paths
- Complex error handling
- Backfilling is painful

### With CDC

```typescript
// CDC approach: Just write to database
async function createEvent(event) {
  // 1. Write to database
  const saved = await db.events.insert(event);

  // That's it! Debezium automatically publishes to Kafka
  // - No dual-write problem
  // - Can't forget to publish
  // - Backfilling is just replaying the change stream
}
```

Benefits:
- Single write operation
- Automatic, reliable event publishing
- Guaranteed consistency
- Easy backfilling and replay

## Extending the Example

### Adding More Processors

Create additional consumers for different processing needs:

```typescript
// Add a validation processor
const validationConsumer = kafka.consumer({ groupId: 'validation-processor' });
await validationConsumer.subscribe({ topic: 'events.events_development.event' });

// Add an analytics processor
const analyticsConsumer = kafka.consumer({ groupId: 'analytics-processor' });
await analyticsConsumer.subscribe({ topic: 'events.events_development.event' });
```

Each consumer group processes independently - Kafka handles fan-out automatically.

### Scaling Horizontally

Run multiple instances of the processor:

```bash
# Terminal 1
node dist/index.js

# Terminal 2
node dist/index.js

# Terminal 3
node dist/index.js
```

Kafka automatically distributes partitions across consumer group members.

### Adding More Event Types

Just add new fields to your events - no infrastructure changes needed:

```typescript
// New event type
POST /event/api
{
  "name": "user_logout",
  "data": "{\"user_id\":\"user123\",\"session_duration_ms\":3600000}",
  "timestamp": "2025-01-15T11:30:00Z",
  "source": "auth_service",
  "version": "1.0"
}
```

The processor can handle different event types with a simple switch statement.

## Production Considerations

This example uses simplified settings for demonstration. For production:

1. **MongoDB**:
   - Use proper replica set with multiple nodes
   - Configure authentication
   - Set up backups

2. **Kafka/Redpanda**:
   - Use a proper cluster (3+ nodes)
   - Configure retention policies
   - Set up monitoring (Prometheus/Grafana)

3. **Debezium**:
   - Use Kafka Connect cluster instead of Debezium Server
   - Configure proper offset storage (Kafka topics, not files)
   - Set up alerting for connector failures

4. **Processor**:
   - Add proper error handling and dead letter queues
   - Implement retries with exponential backoff
   - Add metrics and tracing
   - Use consumer group management for scaling

5. **Security**:
   - Enable TLS for all connections
   - Configure SASL authentication for Kafka
   - Use network policies to restrict access
   - Implement API authentication/authorization

## Monitoring and Debugging

### Check Kafka Topics

```bash
# List topics
docker exec -it redpanda rpk topic list

# Consume messages from raw events topic
docker exec -it redpanda rpk topic consume events.events_development.event

# Consume messages from processed events topic
docker exec -it redpanda rpk topic consume events.events_development.processedevent
```

### Check MongoDB Collections

```bash
# Connect to MongoDB
docker exec -it mongodb mongosh

# Use the database
use events_development

# Check raw events
db.event.find().pretty()

# Check processed events
db.processedevent.find().pretty()
```

### Check Debezium Logs

```bash
docker logs debezium -f
```

Look for:
- "Snapshot completed"
- "Streaming started"
- Error messages if connector fails

### Test GraphQL Queries

```bash
# Query raw events
curl -X POST http://localhost:4055/event/graph \
  -H "Content-Type: application/json" \
  -d '{"query": "{ getByName(name: \"user_login\") { id name source timestamp } }"}'

# Query processed events
curl -X POST http://localhost:4055/processedevent/graph \
  -H "Content-Type: application/json" \
  -d '{"query": "{ getByName(name: \"user_login\") { id status processing_time_ms } }"}'
```

## Key Takeaways

1. **CDC makes event processing trivial**: No need to build custom event publishing infrastructure
2. **Battle-tested technology**: Debezium and Kafka are proven at massive scale
3. **Minimal code**: The processor is ~100 lines, everything else is configuration
4. **Reliable by default**: Exactly-once semantics, automatic retry, proper ordering
5. **Easy to extend**: Add more processors, event types, or processing steps without infrastructure changes
6. **Standard tooling**: REST + GraphQL + Kafka - use familiar tools and libraries

This pattern is particularly valuable when:
- You need reliable event processing without building custom infrastructure
- You want to add event-driven features to an existing database-backed application
- You need to scale event processing independently of your main application
- You want to support multiple consumers of the same events (analytics, validation, notifications, etc.)

## License

See monorepo root LICENSE file.
