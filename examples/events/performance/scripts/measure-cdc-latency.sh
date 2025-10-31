#!/bin/bash
# Measures end-to-end CDC latency by comparing timestamps in Kafka topics
# Run this AFTER running the JMeter test to analyze the CDC pipeline latency

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== CDC Pipeline Latency Measurement ===${NC}"
echo ""

# Check if we can access Kafka
KAFKA_CONTAINER=$(docker ps -q -f name=kafka)
if [ -z "$KAFKA_CONTAINER" ]; then
    KAFKA_CONTAINER=$(docker ps -q -f name=redpanda)
fi

if [ -z "$KAFKA_CONTAINER" ]; then
    echo -e "${RED}Error: Kafka container not found${NC}"
    exit 1
fi

# Fetch recent messages from both topics
echo "Fetching events from Kafka topics..."

# Get raw events (last 50)
docker exec "$KAFKA_CONTAINER" kafka-console-consumer \
    --bootstrap-server localhost:9093 \
    --topic events.events_development.event \
    --from-beginning \
    --max-messages 50 \
    --timeout-ms 3000 2>/dev/null > /tmp/raw_events_cdc.json || true

# Get processed events (last 50)
docker exec "$KAFKA_CONTAINER" kafka-console-consumer \
    --bootstrap-server localhost:9093 \
    --topic events.events_development.processedevent \
    --from-beginning \
    --max-messages 50 \
    --timeout-ms 3000 2>/dev/null > /tmp/processed_events_cdc.json || true

# Analyze with Python
python3 << 'PYTHON_SCRIPT'
import json
import sys

# Parse raw events
raw_events = {}
try:
    with open('/tmp/raw_events_cdc.json', 'r') as f:
        for line in f:
            if not line.strip():
                continue
            try:
                msg = json.loads(line.strip())
                after_str = msg.get('payload', {}).get('after', '{}')
                if isinstance(after_str, str):
                    after = json.loads(after_str)
                else:
                    after = after_str

                event_id = after.get('id')
                created_at = after.get('created_at', {}).get('$date')
                payload = after.get('payload', {})
                name = payload.get('name', after.get('name'))

                if event_id and created_at and name and ('cdc_latency_test' in str(name) or 'perf_test_event' in str(name)):
                    raw_events[event_id] = {
                        'name': name,
                        'created_at': created_at
                    }
            except (json.JSONDecodeError, KeyError, AttributeError):
                continue
except FileNotFoundError:
    pass

# Parse processed events and calculate latencies
latencies = []
try:
    with open('/tmp/processed_events_cdc.json', 'r') as f:
        for line in f:
            if not line.strip():
                continue
            try:
                msg = json.loads(line.strip())
                after_str = msg.get('payload', {}).get('after', '{}')
                if isinstance(after_str, str):
                    after = json.loads(after_str)
                else:
                    after = after_str

                payload = after.get('payload', {})
                raw_event_id = payload.get('raw_event_id')
                processed_at = after.get('created_at', {}).get('$date')
                name = payload.get('name')

                if raw_event_id in raw_events and processed_at:
                    raw_created_at = raw_events[raw_event_id]['created_at']
                    latency_ms = processed_at - raw_created_at

                    latencies.append({
                        'name': name,
                        'raw_event_id': raw_event_id,
                        'latency_ms': latency_ms
                    })
            except (json.JSONDecodeError, KeyError, AttributeError):
                continue
except FileNotFoundError:
    pass

# Display results
if not latencies:
    print("\033[0;33mNo matching CDC events found.\033[0m")
    print("Make sure you've run the JMeter test first: yarn perf cdc-pipeline-latency.jmx")
    sys.exit(1)

latency_values = [r['latency_ms'] for r in latencies]
latency_values.sort()

count = len(latency_values)
avg = sum(latency_values) / count
min_lat = min(latency_values)
max_lat = max(latency_values)
p50 = latency_values[int(count * 0.50)]
p90 = latency_values[int(count * 0.90)]
p95 = latency_values[int(count * 0.95)]
p99 = latency_values[int(count * 0.99)] if count > 1 else max_lat

print(f"\n\033[0;32mCDC Pipeline Latency Analysis\033[0m")
print(f"\nEvents analyzed: {count}")
print(f"\nEnd-to-End Latency (POST → MongoDB → Debezium → Kafka → Processor → MongoDB):")
print(f"  Min:     {min_lat:>6} ms")
print(f"  Average: {avg:>6.0f} ms")
print(f"  Median:  {p50:>6} ms")
print(f"  p90:     {p90:>6} ms")
print(f"  p95:     {p95:>6} ms")
print(f"  p99:     {p99:>6} ms")
print(f"  Max:     {max_lat:>6} ms")

# Distribution
under_500ms = len([l for l in latency_values if l < 500])
under_1s = len([l for l in latency_values if 500 <= l < 1000])
under_3s = len([l for l in latency_values if 1000 <= l < 3000])
over_3s = len([l for l in latency_values if l >= 3000])

print(f"\nDistribution:")
print(f"  <500ms:  {under_500ms:>3} ({under_500ms/count*100:>5.1f}%)")
print(f"  500ms-1s: {under_1s:>3} ({under_1s/count*100:>5.1f}%)")
print(f"  1-3s:    {under_3s:>3} ({under_3s/count*100:>5.1f}%)")
print(f"  >3s:     {over_3s:>3} ({over_3s/count*100:>5.1f}%)")

# Sample events
print(f"\nSample events (first 5):")
for r in latencies[:5]:
    print(f"  {r['name']}: {r['latency_ms']}ms")

print("")

PYTHON_SCRIPT

# Cleanup
rm -f /tmp/raw_events_cdc.json /tmp/processed_events_cdc.json

echo -e "${GREEN}Done!${NC}"
