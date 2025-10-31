/**
 * k6 CDC Latency Test
 *
 * Measures end-to-end latency of the CDC pipeline:
 * HTTP POST → MongoDB → Debezium → Kafka (raw) → Processor → MongoDB → Debezium → Kafka (processed)
 *
 * Installation:
 *   sudo pacman -S k6  # Arch Linux
 *   # OR download from: https://k6.io/docs/getting-started/installation/
 *
 * For Kafka support, you need xk6-kafka extension:
 *   go install go.k6.io/xk6/cmd/xk6@latest
 *   xk6 build --with github.com/mostafa/xk6-kafka@latest
 *   # This creates a ./k6 binary with Kafka support
 *
 * Run:
 *   ./k6 run cdc-latency.k6.js
 *   ./k6 run --vus 10 --duration 30s cdc-latency.k6.js  # Load test
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';

// Custom metrics
const httpToA = new Trend('cdc_http_to_raw', true);
const aToB = new Trend('cdc_raw_to_processed', true);
const httpToB = new Trend('cdc_end_to_end', true);
const timeouts = new Counter('cdc_timeouts');

// Test configuration
export const options = {
  vus: 1,
  iterations: 10,
  thresholds: {
    'cdc_end_to_end': ['p(95)<1000'], // 95% under 1 second
    'cdc_timeouts': ['count<1'],       // No timeouts allowed
  },
};

// Generate UUID v4
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default function () {
  const correlationId = uuidv4();
  const t0 = Date.now();

  // Step 1: POST event via HTTP
  const payload = JSON.stringify({
    name: `k6_perf_test_${correlationId}`,
    correlationId: correlationId,
    data: { test: true, timestamp: t0 },
    timestamp: new Date(t0).toISOString(),
    source: 'k6_performance_test',
    version: '1.0'
  });

  const response = http.post('http://localhost:4055/event/api', payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(response, {
    'HTTP POST successful': (r) => r.status === 200 || r.status === 303,
  });

  // Step 2: Poll Kafka for the event
  // NOTE: This requires xk6-kafka extension
  // Without the extension, we'll use a workaround with polling a status endpoint

  const maxWait = 15000; // 15 seconds
  const pollInterval = 100; // 100ms
  let tA = null;
  let tB = null;

  // Poll for raw event in Kafka (Topic A)
  const startPollA = Date.now();
  while (Date.now() - startPollA < maxWait && tA === null) {
    // TODO: Replace with actual Kafka consumer when xk6-kafka is available
    // For now, we'll use a workaround: query a status endpoint
    const statusResponse = http.get(`http://localhost:4055/event/status/${correlationId}`);
    if (statusResponse.status === 200) {
      const status = JSON.parse(statusResponse.body);
      if (status.rawEventReceived) {
        tA = Date.now();
      }
    }
    if (tA === null) {
      sleep(pollInterval / 1000);
    }
  }

  if (tA === null) {
    console.error(`Timeout waiting for raw event: ${correlationId}`);
    timeouts.add(1);
    return;
  }

  // Poll for processed event in Kafka (Topic B)
  const startPollB = Date.now();
  while (Date.now() - startPollB < maxWait && tB === null) {
    const statusResponse = http.get(`http://localhost:4055/event/status/${correlationId}`);
    if (statusResponse.status === 200) {
      const status = JSON.parse(statusResponse.body);
      if (status.processedEventReceived) {
        tB = Date.now();
      }
    }
    if (tB === null) {
      sleep(pollInterval / 1000);
    }
  }

  if (tB === null) {
    console.error(`Timeout waiting for processed event: ${correlationId}`);
    timeouts.add(1);
    return;
  }

  // Record latencies
  const latHttpToA = tA - t0;
  const latAToB = tB - tA;
  const latHttpToB = tB - t0;

  httpToA.add(latHttpToA);
  aToB.add(latAToB);
  httpToB.add(latHttpToB);

  console.log(`✓ ${correlationId}: HTTP→A=${latHttpToA}ms, A→B=${latAToB}ms, HTTP→B=${latHttpToB}ms`);
}
