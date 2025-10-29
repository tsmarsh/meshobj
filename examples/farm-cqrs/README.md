# Farm CQRS Example

**Command Query Responsibility Segregation (CQRS) with MongoDB Replica Set**

This example demonstrates separating read and write operations into dedicated services, with writes going to a MongoDB primary and reads coming from a MongoDB replica.

## Architecture

```
                     COMMANDS                QUERIES
                   (mutations)              (queries)
                        │                       │
                        ▼                       ▼
              ┌──────────────────┐    ┌──────────────────┐
              │  Write Service   │    │   Read Service   │
              │   (REST API)     │    │   (GraphQL)      │
              │   Port: 3034     │    │   Port: 3035     │
              └────────┬─────────┘    └────────┬─────────┘
                       │                       │
                       ▼                       ▼
                  ┌─────────┐             ┌─────────┐
                  │ MongoDB │─replicates─▶│ MongoDB │
                  │ Primary │             │ Replica │
                  │ :27017  │             │ :27018  │
                  └─────────┘             └─────────┘
```

## CQRS Pattern

**Command Query Responsibility Segregation** separates:
- **Commands (Writes):** REST API mutations → MongoDB Primary
- **Queries (Reads):** GraphQL queries → MongoDB Replica (secondary read preference)

### Benefits

1. **Independent Scaling**
   - Scale write service for mutation throughput
   - Scale read service for query concurrency
   - Different resource profiles (CPU vs memory)

2. **Eliminates Contention**
   - Queries don't compete with writes for connections
   - Each service has dedicated connection pool
   - No event loop interference

3. **Read Performance**
   - Queries served from dedicated replica
   - No write locks blocking reads
   - Can add multiple read replicas

4. **Production-Realistic**
   - Common deployment pattern
   - Demonstrates MongoDB replica sets
   - Shows multi-service architecture

## Services

### Write Service (Port 3034)
**Endpoints:**
- `/farm/api` - Farm REST CRUD
- `/coop/api` - Coop REST CRUD
- `/hen/api` - Hen REST CRUD
- `/ready` - Health check

**Database:** MongoDB Primary (writes)

### Read Service (Port 3035)
**Endpoints:**
- `/farm/graph` - Farm GraphQL queries
- `/coop/graph` - Coop GraphQL queries
- `/hen/graph` - Hen GraphQL queries
- `/ready` - Health check

**Database:** MongoDB Replica (reads with `readPreference: secondary`)

## Quick Start

```bash
# Start all services (MongoDB replica set + write/read services)
docker-compose up -d

# Check services are ready
yarn perf:check

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Example Usage

### Create Data (Write Service - REST)
```bash
# Create a farm
curl -X POST http://localhost:3034/farm/api \
  -H "Content-Type: application/json" \
  -d '{"name":"Sunny Acres Farm"}'
# Returns: Location: /farm/api/<farm-id>

# Create a coop
curl -X POST http://localhost:3034/coop/api \
  -H "Content-Type: application/json" \
  -d '{"name":"Red Barn Coop","farm_id":"<farm-id>"}'
# Returns: Location: /coop/api/<coop-id>

# Create hens
curl -X POST http://localhost:3034/hen/api \
  -H "Content-Type: application/json" \
  -d '{"name":"Henrietta","coop_id":"<coop-id>","eggs":5,"dob":"2024-01-15"}'
```

### Query Data (Read Service - GraphQL)
```bash
# Query farm with all relationships
curl -X POST http://localhost:3035/farm/graph \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{ getById(id: \"<farm-id>\") {
      id
      name
      coops {
        id
        name
        hens {
          name
          eggs
        }
      }
    } }"
  }'
```

## Performance Testing

Run the same JMeter tests as the monolithic farm example:

```bash
# Mixed workload (REST writes + GraphQL reads)
yarn perf example-mixed-workload.jmx

# Full object graph test
yarn perf example-full-graph.jmx

# GraphQL-only (latency investigation)
yarn perf example-graphql-only.jmx
```

## Expected Performance Improvements

### Monolithic Farm (Baseline)
- REST Create: 0.6ms
- GraphQL Get (single-client): 5-7ms
- GraphQL Get (10 concurrent): **77ms avg** (10x degradation)
- **Root cause:** Connection pool + event loop contention

### CQRS Farm (This Example)
**Hypothesis:**
- REST Create: ~0.6ms (unchanged)
- GraphQL Get (single-client): ~5-7ms (unchanged)
- GraphQL Get (10 concurrent): **Expected 10-20ms** (2-4x improvement!)

**Why the improvement?**
1. Dedicated connection pool for reads
2. No write operations competing for connections
3. Separate Node.js event loops
4. MongoDB replica optimized for reads

## MongoDB Replica Set

This example includes automatic replica set initialization:

```yaml
services:
  mongodb-primary:
    command: mongod --replSet rs0 --bind_ip_all

  mongodb-replica:
    command: mongod --replSet rs0 --bind_ip_all

  mongo-init:
    # Initializes replica set on startup
```

**Replication lag:** Typically <100ms for local replicas

## Configuration Details

### Write Service (write-service.conf)
```hocon
restlettes = [...]  # REST endpoints only
graphlettes = []    # No GraphQL
```

### Read Service (read-service.conf)
```hocon
restlettes = []     # No REST
graphlettes = [...]  # GraphQL endpoints only

# All database configs use secondary read preference
henDB = {
  type = "mongo"
  uri = ${?MONGO_URI}
  options {
    replicaSet = "rs0"
    readPreference = "secondary"  # Read from replica!
  }
}
```

## Comparison with Monolithic Farm

| Aspect | Monolithic Farm | CQRS Farm |
|--------|----------------|-----------|
| **Services** | 1 (REST + GraphQL) | 2 (Write + Read) |
| **Databases** | 1 MongoDB | 1 Primary + 1 Replica |
| **Write Performance** | 0.6ms | ~0.6ms (same) |
| **Read Performance** | 77ms (10 concurrent) | 10-20ms (estimated) |
| **Scaling** | Vertical only | Independent horizontal |
| **Complexity** | Lower | Higher |
| **Production Readiness** | Good | Better |

## When to Use CQRS

**Use CQRS when:**
- ✅ Read/write ratio is heavily skewed (e.g., 90/10)
- ✅ Read and write operations have different scaling needs
- ✅ You need to optimize query performance under load
- ✅ You're already using MongoDB replica sets

**Stick with monolithic when:**
- ❌ Simple CRUD with balanced read/write
- ❌ Small scale (single-digit req/sec)
- ❌ Development/testing only
- ❌ Team unfamiliar with distributed systems

## Troubleshooting

### Services not starting
```bash
# Check replica set status
docker exec -it farm-cqrs-mongo-primary mongosh --eval "rs.status()"

# Check service logs
docker-compose logs write-service
docker-compose logs read-service
```

### Replication lag
```bash
# Check replication lag
docker exec -it farm-cqrs-mongo-replica mongosh --eval "rs.printSecondaryReplicationInfo()"
```

### Performance testing
```bash
# Ensure services are ready before testing
yarn perf:check

# View detailed results
open performance/results/<test>_<timestamp>_report/index.html
```

## Next Steps

After verifying improved performance:
1. Document actual performance improvements in `performance/PERFORMANCE.md`
2. Compare with monolithic farm results
3. Add more read replicas to test read scaling
4. Explore write scaling with sharding

## Further Reading

- [CQRS Pattern](https://martinfowler.com/bliki/CQRS.html)
- [MongoDB Replica Sets](https://www.mongodb.com/docs/manual/replication/)
- [Event Sourcing + CQRS](https://martinfowler.com/eaaDev/EventSourcing.html)
