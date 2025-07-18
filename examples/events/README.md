# Event Processing System - A Dual-Service Example

This example demonstrates how to use MeshQL to build an event processing system with two interconnected services that handle raw events and processed events. It showcases cross-service GraphQL resolution and polyglot persistence patterns.

## Architecture Overview

The system consists of two main services:

- **Raw Events Service** (MongoDB) - Receives and stores incoming events as they arrive
- **Processed Events Service** (PostgreSQL) - Stores events after processing/transformation with links back to raw events

### Key Features

- **Event Lifecycle Tracking**: Complete traceability from raw input to processed output
- **Cross-Service GraphQL Resolution**: Query processed events and automatically resolve their raw event data
- **Polyglot Persistence**: MongoDB for flexible raw event storage, PostgreSQL for structured processed data
- **Unified Query Interface**: Single GraphQL endpoint to query across both services
- **REST API Support**: Each service exposes CRUD operations via REST with OpenAPI docs

## Database Choice Rationale

- **Raw Events (MongoDB)**
  - Flexible schema for varying event structures
  - High write throughput for event ingestion
  - Native JSON storage for arbitrary event payloads
  - Excellent for time-series data patterns

- **Processed Events (PostgreSQL)**
  - Structured relationships between raw and processed events
  - ACID compliance for processing status tracking
  - Strong consistency for processing pipeline integrity
  - Efficient foreign key lookups for event correlation

## Getting Started

### Prerequisites

- Docker and docker-compose
- Node.js 20+
- Yarn

### Running the Application

1. Start the services:
   ```bash
   docker-compose up
   ```

2. The following endpoints will be available:
   - GraphQL Endpoints:
     - Raw Events: http://localhost:4055/raw-events/graph
     - Processed Events: http://localhost:4055/processed-events/graph
   - REST API Documentation:
     - Raw Events: http://localhost:4055/raw-events/api/api-docs
     - Processed Events: http://localhost:4055/processed-events/api/api-docs

### Running Tests

```bash
npm test
```

## Example Usage

### Creating a Raw Event

```bash
curl -X POST http://localhost:4055/raw-events/api \
  -H "Content-Type: application/json" \
  -d '{
    "name": "user_login",
    "data": {
      "user_id": "user123",
      "username": "john_doe",
      "ip_address": "192.168.1.100"
    },
    "timestamp": "2024-01-01T12:00:00Z",
    "source": "auth_service",
    "version": "1.0"
  }'
```

### Creating a Processed Event

```bash
curl -X POST http://localhost:4055/processed-events/api \
  -H "Content-Type: application/json" \
  -d '{
    "raw_event_id": "raw_event_uuid_here",
    "name": "user_login",
    "processed_data": {
      "user_id": "user123",
      "username": "john_doe",
      "login_country": "US",
      "risk_score": 0.1
    },
    "processed_timestamp": "2024-01-01T12:00:01Z",
    "status": "SUCCESS",
    "processing_time_ms": 45.2
  }'
```

### GraphQL Queries

#### Query Raw Events by Name
```graphql
{
  getByName(name: "user_login") {
    id
    name
    data
    timestamp
    source
    metadata
  }
}
```

#### Query Processed Events with Raw Event Resolution
```graphql
{
  getByName(name: "user_login") {
    id
    name
    processed_data
    status
    processing_time_ms
    rawEvent {
      id
      name
      data
      timestamp
      source
    }
  }
}
```

#### Find All Processed Events for a Raw Event
```graphql
{
  getByRawEventId(raw_event_id: "raw_event_uuid_here") {
    id
    name
    status
    processed_timestamp
    error_message
  }
}
```

## Configuration

The system uses HOCON configuration format in `config/config.conf`:

```hocon
{
  "port": 4055,
  "graphlettes": [
    {
      "path": "/raw-events/graph",
      "storage": {
        "type": "mongo",
        "uri": "mongodb://localhost:27017/events",
        "collection": "raw_events"
      },
      "schema": "config/graph/raw_event.graphql"
    },
    {
      "path": "/processed-events/graph", 
      "storage": {
        "type": "postgres",
        "uri": "postgresql://localhost:5432/events",
        "collection": "processed_events"
      },
      "schema": "config/graph/processed_event.graphql",
      "rootConfig": {
        "resolvers": [
          {
            "name": "rawEvent",
            "queryName": "getById",
            "url": "http://localhost:4055/raw-events/graph"
          }
        ]
      }
    }
  ]
}
```

## Event Processing Flow

1. **Raw Event Ingestion**: Events arrive via REST API and are stored in MongoDB
2. **Event Processing**: External processors consume raw events and create processed versions
3. **Cross-Service Linking**: Processed events reference raw events via `raw_event_id`
4. **Unified Querying**: GraphQL automatically resolves relationships between services

## Schema Details

### Raw Event Schema
- `id`: Unique identifier
- `name`: Event type/name
- `data`: Arbitrary JSON payload
- `timestamp`: Event occurrence time
- `source`: Originating system
- `version`: Event schema version
- `metadata`: Additional context

### Processed Event Schema
- `id`: Unique identifier
- `raw_event_id`: Link to original raw event
- `name`: Event type (matches raw event)
- `processed_data`: Transformed/enriched data
- `processed_timestamp`: Processing completion time
- `status`: SUCCESS/FAILED/PARTIAL
- `processing_time_ms`: Processing duration
- `enrichment_data`: Additional data added during processing

## Development

### Project Structure
```
examples/events/
├── config/
│   ├── graph/              # GraphQL schemas
│   │   ├── raw_event.graphql
│   │   └── processed_event.graphql
│   ├── json/               # JSON schemas for REST APIs
│   │   ├── raw_event.schema.json
│   │   └── processed_event.schema.json
│   └── config.conf         # Main configuration
├── test/                   # Integration tests
│   ├── config.ts
│   └── events.wip.ts
├── docker-compose.yml      # Container orchestration
└── Dockerfile             # Service container
```

### Testing

The test suite demonstrates:
- Creating raw and processed events via REST API
- Querying events by name using GraphQL
- Cross-service resolution of raw events from processed events
- Querying processed events by raw event ID

## Use Cases

This pattern is ideal for:
- **Event-Driven Architectures**: Tracking event processing pipelines
- **Data Processing Systems**: ETL workflows with audit trails
- **Message Processing**: Queue/stream processing with status tracking
- **Analytics Pipelines**: Raw data ingestion with processed results
- **Compliance Systems**: Immutable event logs with processing history