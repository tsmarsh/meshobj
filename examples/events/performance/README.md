# Events CDC Pipeline Performance Tests

Performance testing suite for the Events CDC pipeline, measuring throughput and latency of event processing.

## What We're Measuring

This CDC pipeline has several interesting performance characteristics worth benchmarking:

1. **Event Creation Throughput**: How fast can we write events via REST API?
2. **MongoDB Write Performance**: Database insert latency
3. **CDC Latency**: How long does it take for Debezium to capture changes and publish to Kafka?
4. **End-to-End Latency**: Total time from API write → MongoDB → Debezium → Kafka → Processor → Processed Event

The key insight: **CDC adds latency but enables massive scale**. You trade ~1-3 seconds of CDC latency for:
- Zero-code event publishing
- Guaranteed delivery
- Built-in ordering
- Horizontal scalability
- Backpressure handling

## Prerequisites

1. **JMeter** - Download from https://jmeter.apache.org/download_jmeter.cgi
   - Arch Linux: `sudo pacman -S jmeter`
   - Either set `JMETER_HOME` environment variable
   - Or add `jmeter` to your PATH

2. **JMeter Kafka Plugin** (for CDC latency tests):
   ```bash
   # Option 1: Via JMeter Plugin Manager (recommended)
   # Open JMeter GUI, go to Options → Plugins Manager
   # Install "DI Kafka" or "Pepper-Box - Kafka Load Generator"

   # Option 2: Manual installation
   cd /usr/share/jmeter/lib/ext  # or $JMETER_HOME/lib/ext
   sudo wget https://github.com/rollno748/di-kafkameter/releases/download/v0.2.0/di-kafkameter-0.2.0.jar
   ```

3. **Running services** - Start the events CDC stack:
   ```bash
   cd examples/events/generated
   docker-compose up -d

   # Wait ~60 seconds for all services to initialize
   # You should see "Snapshot completed" and "Streaming started" in logs
   ```

## Running Tests

### Check if services are ready
```bash
yarn perf:check
```

### Run all performance tests
```bash
yarn perf
```

### Run a specific test plan
```bash
yarn perf event-creation-throughput.jmx
```

## Test Scenarios

### 1. Event Creation Throughput
**Test Plan**: `event-creation-throughput.jmx`

**What it tests**:
- REST API write throughput (POST /event/api)
- MongoDB insert performance
- Connection pooling effectiveness

**Configuration**:
- 10 concurrent threads (simulated users)
- 100 iterations per thread = 1,000 total events
- 5-second ramp-up time

**Expected Results**:
- Throughput: 100-500 requests/sec (depends on hardware)
- Average latency: 10-50ms
- p99 latency: < 100ms

**What this tells you**: How fast you can write events to the system. This is your **ingestion capacity**.

### 2. CDC Pipeline End-to-End Latency
**Test Plan**: `cdc-pipeline-latency.jmx`

**What it tests**:
- API event creation throughput and latency
- Full CDC pipeline can be observed separately via Kafka console

**Configuration**:
- 10 concurrent threads sending events
- 100 iterations per thread = 1,000 total events
- 5-second ramp-up time

**How to run (single command)**:
```bash
# Run test and automatically measure CDC latency
yarn perf cdc-pipeline-latency.jmx && sleep 5 && ./performance/scripts/measure-cdc-latency.sh
```

This will:
1. Post 1,000 events via the REST API
2. Wait 5 seconds for CDC pipeline to process
3. Analyze Kafka topics to measure end-to-end latency

**Expected API Results**:
- Throughput: 100-500 requests/sec
- Average latency: 8-10ms
- p99 latency: < 100ms
- Success rate: 100%

**Observing CDC Pipeline in Real-Time** (optional):

To watch events flow through Kafka while the test runs, open two terminal windows:

Terminal 1 - Watch raw events:
```bash
docker exec -it generated-kafka-1 kafka-console-consumer \
  --bootstrap-server localhost:9093 \
  --topic events.events_development.event \
  --from-beginning
```

Terminal 2 - Watch processed events:
```bash
docker exec -it generated-kafka-1 kafka-console-consumer \
  --bootstrap-server localhost:9093 \
  --topic events.events_development.processedevent \
  --from-beginning
```

You'll see events appearing in real-time as they flow through the CDC pipeline!

**Measuring CDC Latency**:

After running the test, measure end-to-end latency:
```bash
./performance/scripts/measure-cdc-latency.sh
```

This script analyzes timestamps from both Kafka topics to calculate:
- Min/Average/Max latency
- p90/p95/p99 percentiles
- Latency distribution

**Expected CDC Results**:
- API write latency: 8-10ms (MongoDB insert)
- CDC pipeline latency: 200-600ms (MongoDB → Kafka → Processor → MongoDB → Kafka)
- Total end-to-end: < 1 second

**What this tells you**: The actual end-to-end latency users experience from writing an event to seeing it processed. Under optimal conditions, the CDC pipeline achieves sub-second latency!

## Understanding the Results

After running tests, open the HTML report:
```bash
# Find the latest report
ls -lt performance/results/

# Open in browser
open performance/results/<test-name>_<timestamp>_report/index.html
```

### Key Metrics

#### 1. Throughput (Requests/sec)
- **What it means**: How many events/sec the system can handle
- **Good**: > 100 req/sec for single-instance setup
- **Great**: > 500 req/sec
- **Bottlenecks**: MongoDB, network I/O, Docker overhead

#### 2. Response Time
- **Average**: Typical case performance
- **p90**: 90% of requests complete within this time
- **p95**: 95% of requests (catching slowdowns)
- **p99**: 99% of requests (catching outliers)

**For event creation**:
- Average: 10-30ms is normal (MongoDB insert time)
- p99: < 100ms is good (includes occasional GC pauses)

#### 3. Error Rate
- **Should be**: 0%
- **If > 0%**: Check logs for connection errors, timeout issues, or schema validation failures

#### 4. Latency Breakdown
JMeter reports show:
- **Connect Time**: TCP connection establishment (should be ~1ms with keepalive)
- **Latency**: Time to first byte (TTFB)
- **Response Time**: Total time

## CDC-Specific Performance Characteristics

### The CDC Latency Tax

Writing an event to the API is fast (10-50ms), but seeing it processed takes longer:

```
User writes event → 10ms (REST API → MongoDB)
                  ↓
MongoDB change stream → 1-3 seconds (Debezium polling interval)
                  ↓
Kafka publish → 10-50ms
                  ↓
Processor consumes → 100-500ms (includes API call to write processed event)
                  ↓
Total end-to-end: 3-5 seconds
```

**Why the delay?**
- Debezium polls MongoDB's change stream every 500ms-1s
- Kafka batching (configurable)
- Consumer group rebalancing (if multiple instances)

### When This Matters vs Doesn't Matter

**CDC is perfect when**:
- You need reliable, ordered event processing
- You can tolerate 3-5 second latency
- You want zero custom code for event publishing
- You need to support multiple consumers
- Examples: Analytics, notifications, audit logs, ETL

**CDC is NOT ideal when**:
- You need sub-second latency
- Events must be processed synchronously
- You can't afford any delays
- Examples: Real-time pricing, fraud detection, high-frequency trading

For those cases, consider:
- Direct Kafka publishing (skip CDC)
- In-memory event buses (Redis Streams)
- Synchronous processing in the API handler

## Monitoring During Tests

While tests are running, monitor the system:

```bash
# Docker resource usage
docker stats

# Kafka lag (should stay low)
docker exec -it kafka kafka-consumer-groups \
  --bootstrap-server localhost:9093 \
  --group events-e2e-processor \
  --describe

# MongoDB operations
docker exec -it mongodb mongosh events_development --eval 'db.serverStatus().opcounters'

# Processor logs
docker logs events -f
```

## Creating Custom Test Plans

1. Open JMeter GUI:
   ```bash
   jmeter
   ```

2. Create your test plan with:
   - **Thread Group**: Define load (users, ramp-up, iterations)
   - **HTTP Request Sampler**: Configure API calls
   - **Header Manager**: Set Content-Type: application/json
   - **Listeners**: Summary Report, Aggregate Report, Graph Results

3. Test locally in GUI mode first

4. Save to `test-plans/*.jmx`

5. Run via script for CI/automated testing

### Example: Testing GraphQL Queries

Create a sampler for:
```
POST /event/graph
Content-Type: application/json

{
  "query": "{ getByName(name: \"perf_test\") { id name timestamp } }"
}
```

## Advanced Test Scenarios

### Spike Test
- Simulate sudden load increase
- Ramp from 10 to 100 users in 10 seconds
- Tests system behavior under stress

### Endurance Test
- Run at moderate load for extended period (30+ minutes)
- Checks for memory leaks, connection pool exhaustion
- Use 20 threads, 10,000 iterations

### Mixed Workload
- 70% reads (GraphQL queries)
- 30% writes (event creation)
- Simulates realistic usage

## Tips for Accurate Results

1. **Warm up the system**:
   ```bash
   # Send 100 events first to warm caches
   for i in {1..100}; do
     curl -X POST http://localhost:4055/event/api \
       -H "Content-Type: application/json" \
       -d '{"name":"warmup","data":"{}","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","source":"warmup","version":"1.0"}'
   done
   ```

2. **Run tests multiple times**: First run is often slower (cold start)

3. **Monitor resources**: Use `docker stats` to check if you're CPU/memory bound

4. **Clear data between tests**:
   ```bash
   docker exec mongodb mongosh events_development --eval 'db.event.deleteMany({})'
   ```

5. **Increase Docker resources**: Give Docker more CPU/RAM if bottlenecked

## Interpreting Results for CDC Pipelines

### Good Performance Indicators

✓ **API writes are fast (< 50ms)**: Shows the REST layer and MongoDB are performant
✓ **Zero errors**: System is stable under load
✓ **Linear scaling**: 2x threads ≈ 2x throughput (up to resource limits)
✓ **Consistent latency**: p99 not much higher than average (predictable performance)

### Red Flags

✗ **High error rate**: Connection pool exhaustion, timeouts
✗ **Increasing latency over time**: Memory leak, connection leak
✗ **Throughput plateau**: Hit system limit (DB, CPU, network)
✗ **High p99 latency**: GC pauses, disk I/O blocking

## Baseline Performance Expectations

On a typical development machine (4 CPU, 8GB RAM, Docker Desktop):

| Metric | Value | Notes |
|--------|-------|-------|
| Event creation throughput | 100-300 req/sec | Single API instance |
| Average write latency | 20-40ms | MongoDB insert time |
| p99 write latency | 80-150ms | Includes GC pauses |
| CDC latency | 1-3 seconds | Debezium → Kafka |
| Processing latency | 200-500ms | Processor consumes & writes |
| End-to-end latency | 3-5 seconds | Write → processed event visible |

**Production expectations** (proper hardware, k8s cluster):
- 10x throughput (1,000-3,000 req/sec with horizontal scaling)
- Lower latency (faster disk, more CPU)
- CDC latency stays similar (inherent to change stream polling)

## Next Steps

After running performance tests:

1. **Establish baseline**: Record current performance numbers
2. **Identify bottlenecks**: CPU, memory, disk, network?
3. **Optimize**: Connection pooling, indexes, batching
4. **Re-test**: Measure improvement
5. **Document**: Update this README with your findings

## Troubleshooting

### "Services are not ready"
- Check `docker-compose ps` - are all services running?
- Check `docker logs` for errors
- Wait longer - CDC stack takes ~60 seconds to fully initialize

### "Connection refused"
- Verify port 4055 is exposed: `curl http://localhost:4055/ready`
- Check firewall settings
- Ensure Docker networking is correct

### "Out of memory" errors
- Increase Docker memory limit (Docker Desktop → Preferences → Resources)
- Reduce thread count in test plan
- Check for memory leaks in processor

### JMeter crashes
- Increase JMeter heap: `export JVM_ARGS="-Xms512m -Xmx2048m"`
- Reduce number of concurrent threads
- Disable unnecessary listeners

## Directory Structure

```
performance/
├── test-plans/               # JMeter test plan files (.jmx)
│   └── event-creation-throughput.jmx
├── scripts/
│   ├── wait-for-services.sh # Health check script
│   └── run-perf-tests.sh    # Test orchestration
└── results/                  # Test results (gitignored)
    ├── *.jtl                # Raw results
    ├── *_report/            # HTML reports
    └── *.log                # JMeter logs
```

## Contributing Results

If you run performance tests on interesting hardware, please share:
- Hardware specs (CPU, RAM, disk type)
- Test plan used
- Results summary (throughput, latencies)
- Any bottlenecks discovered

Add to a PERFORMANCE.md file in this directory with the pattern:
```markdown
## Test Run: YYYY-MM-DD

**Hardware**: Mac M1, 8 CPU, 16GB RAM, SSD
**Test**: event-creation-throughput.jmx
**Results**: 450 req/sec, avg 22ms, p99 85ms
**Bottleneck**: MongoDB CPU (80% utilization)
**Notes**: Linear scaling up to 20 threads, plateaus after
```

This helps others understand what performance to expect!
