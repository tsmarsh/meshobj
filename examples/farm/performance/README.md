# Farm Performance Tests

JMeter-based performance testing suite for the Farm example.

## Prerequisites

1. **JMeter** - Download from https://jmeter.apache.org/download_jmeter.cgi
   - Either set `JMETER_HOME` environment variable
   - Or add `jmeter` to your PATH

2. **Running services** - Start the farm example services:
   ```bash
   cd examples/farm
   docker-compose up -d
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
yarn perf graphql-simple.jmx
```

## Directory Structure

```
performance/
├── test-plans/          # JMeter test plan files (.jmx)
├── scripts/
│   ├── wait-for-services.sh    # Health check script
│   └── run-perf-tests.sh       # Test orchestration
└── results/             # Test results (gitignored)
    ├── *.jtl           # Raw results
    ├── *_report/       # HTML reports
    └── *.log           # JMeter logs
```

## Creating Test Plans

1. Open JMeter GUI:
   ```bash
   jmeter
   ```

2. Create your test plan with:
   - Thread Groups (users, ramp-up, iterations)
   - HTTP/GraphQL samplers
   - Listeners for results

3. Save to `test-plans/*.jmx`

## Test Scenarios

### GraphQL Simple
- Baseline performance
- Single-service queries (no resolvers)
- Measures raw GraphQL endpoint speed

### GraphQL Resolvers
- Cross-service resolution
- Farm → Coops → Hens chain
- Measures overhead of federated queries

### REST CRUD
- Create/Read/Update operations
- Measures REST API throughput

### Mixed Workload
- Realistic usage patterns
- 70% reads, 30% writes
- Combination of GraphQL and REST

## Viewing Results

After running tests, open the HTML report:
```bash
open performance/results/<test-name>_<timestamp>_report/index.html
```

Key metrics to review:
- **Requests/sec** - Throughput
- **Response Time** - p50, p90, p99
- **Error Rate** - % failures
- **Throughput** - Bytes/sec

## Tips

- Start with low load (10 users) and increase gradually
- Run tests multiple times for consistency
- Monitor docker stats during tests: `docker stats`
- Clear results regularly to save disk space
