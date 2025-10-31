# k6 CDC Latency Testing

This directory contains k6-based performance tests for measuring CDC (Change Data Capture) pipeline latency.

## Why k6?

- **Fast**: Built in Go, compiled binary with minimal overhead
- **True concurrency**: Go goroutines handle thousands of concurrent VUs efficiently
- **No GC pauses**: Go's GC is designed for low-latency applications
- **Great metrics**: Built-in support for trends, percentiles, thresholds
- **Easy to write**: JavaScript DSL (but runs in Go, not Node.js runtime)
- **Kafka support**: xk6-kafka extension for native Kafka consumers

## Installation

### 1. Install k6 (base)

**Arch Linux:**
```bash
sudo pacman -S k6
```

**Other platforms:**
- Download from: https://k6.io/docs/getting-started/installation/

### 2. Build k6 with Kafka extension (required for CDC tests)

The Kafka extension requires building a custom k6 binary:

```bash
# Install xk6 (k6 extension builder)
go install go.k6.io/xk6/cmd/xk6@latest

# Build k6 with Kafka extension
cd examples/events/performance
xk6 build --with github.com/mostafa/xk6-kafka@latest

# This creates a ./k6 binary in the current directory
```

## Running Tests

### Basic CDC Latency Test (10 iterations)

```bash
cd examples/events/performance
./k6 run cdc-latency-kafka.k6.js
```

Expected output:
```
✓ k6_test_abc123: HTTP→Raw=245ms, Raw→Processed=178ms, E2E=423ms
✓ k6_test_def456: HTTP→Raw=198ms, Raw→Processed=201ms, E2E=399ms
...

     ✓ HTTP POST successful
     ✓ cdc_end_to_end_ms...........: avg=412ms min=198ms med=405ms max=712ms p(90)=589ms p(95)=645ms
     ✓ cdc_http_to_raw_ms..........: avg=215ms min=142ms med=208ms max=398ms p(90)=312ms p(95)=355ms
     ✓ cdc_raw_to_processed_ms.....: avg=197ms min=89ms  med=187ms max=401ms p(90)=298ms p(95)=345ms
     ✓ cdc_timeouts................: 0
```

### Load Test (100 iterations, sequential)

```bash
./k6 run --vus 1 --iterations 100 cdc-latency-kafka.k6.js
```

### Stress Test (10 concurrent users, 30 seconds)

```bash
./k6 run --vus 10 --duration 30s cdc-latency-kafka.k6.js
```

### Save Results to JSON

```bash
./k6 run --out json=results.json cdc-latency-kafka.k6.js
```

### Custom Thresholds

Edit `cdc-latency-kafka.k6.js` and modify the `options` section:

```javascript
export const options = {
  vus: 1,
  iterations: 100,
  thresholds: {
    'cdc_end_to_end_ms': [
      'p(50)<400',   // Median under 400ms
      'p(95)<800',   // 95th percentile under 800ms
      'p(99)<1500',  // 99th percentile under 1.5 seconds
    ],
    'cdc_timeouts': ['count==0'], // Zero timeouts
    'http_req_failed': ['rate<0.01'], // Less than 1% HTTP errors
  },
};
```

## Metrics Explained

- **cdc_http_to_raw_ms**: Time from HTTP POST to event appearing in raw Kafka topic
  - Measures: HTTP → MongoDB → Debezium → Kafka

- **cdc_raw_to_processed_ms**: Time from raw topic to processed topic
  - Measures: Kafka → Event Processor → MongoDB → Debezium → Kafka

- **cdc_end_to_end_ms**: Total pipeline latency (HTTP POST → processed event in Kafka)
  - This is the metric you care about for SLAs

- **cdc_timeouts**: Count of tests that timed out (15s max wait)

## Comparison: k6 vs JMeter

| Feature | k6 | JMeter |
|---------|----|----|
| **Performance** | Excellent (Go) | Poor (Java, heavyweight) |
| **Concurrency** | True parallelism (goroutines) | Thread-based, memory-intensive |
| **Scripting** | JavaScript (simple) | Groovy/BeanShell (painful) |
| **Kafka Support** | Native via xk6-kafka | DI Kafka plugin (buggy, undocumented) |
| **Metrics** | Built-in percentiles, trends | Requires custom listeners |
| **CI/CD** | Easy (single binary) | Complex (Java runtime + deps) |
| **Debugging** | Console output, JSON export | XML results, GUI required |
| **Version Control** | Clean JavaScript | XML hell |

## Troubleshooting

### "Cannot find engine named: 'javascript'"
You're using regular k6, not the Kafka-enabled build. Follow step 2 above to build with xk6.

### "Error connecting to Kafka"
Make sure Kafka is running:
```bash
docker-compose ps kafka
```

### "Timeout waiting for events"
Check that:
1. Events service is running: `curl http://localhost:4055/health`
2. Debezium connector is running: `docker-compose ps debezium`
3. Events are actually being captured: `docker-compose logs -f kafka | grep events_development`

### High latency (>2 seconds)
This usually indicates:
- MongoDB is slow (check: `docker stats mongodb`)
- Kafka is slow (check: `docker stats kafka`)
- Event processor is slow (check logs)
- System is under load (check: `htop`)

## Integration with CI/CD

```yaml
# .github/workflows/perf-test.yml
name: CDC Performance Test
on: [push]
jobs:
  perf:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Start services
        run: docker-compose up -d
      - name: Install k6
        run: |
          go install go.k6.io/xk6/cmd/xk6@latest
          xk6 build --with github.com/mostafa/xk6-kafka@latest
      - name: Run performance test
        run: ./k6 run --quiet examples/events/performance/cdc-latency-kafka.k6.js
      - name: Check thresholds
        run: |
          if grep -q "✗" k6.log; then
            echo "Performance thresholds failed!"
            exit 1
          fi
```

## Next Steps

1. **Install k6**: `sudo pacman -S k6`
2. **Build with Kafka**: `xk6 build --with github.com/mostafa/xk6-kafka@latest`
3. **Run test**: `./k6 run cdc-latency-kafka.k6.js`
4. **Iterate**: Adjust thresholds, add more scenarios, integrate into CI

Fuck JMeter. Let's prove k6 works.
