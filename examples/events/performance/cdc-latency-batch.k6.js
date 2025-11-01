/**
 * k6 CDC Latency Test with Batch Submission and Count-Based Polling
 *
 * Measures end-to-end latency of the CDC pipeline using batch submission
 * and count-based polling instead of searching for individual correlationIds.
 *
 * Prerequisites:
 *   1. Install xk6: go install go.k6.io/xk6/cmd/xk6@latest
 *   2. Build k6 with Kafka: xk6 build --with github.com/mostafa/xk6-kafka@latest
 *   3. This creates ./k6 binary with Kafka support
 *   4. Run cleanup script first: ./performance/cleanup-and-restart.sh
 *
 * Run:
 *   ./k6 run cdc-latency-batch.k6.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter, Gauge } from 'k6/metrics';
import { Reader } from 'k6/x/kafka';

// Custom metrics for CDC pipeline stages
const apiResponseTime = new Trend('cdc_api_response_ms', true);       // Stage 1: Time to HTTP 30x response
const debeziumLag = new Trend('cdc_http_to_raw_ms', true);           // Stage 2: Time to appear on raw topic (Debezium lag)
const processorLag = new Trend('cdc_raw_to_processed_ms', true);     // Stage 3: Time from raw to processed topic (processor lag)
const endToEnd = new Trend('cdc_end_to_end_ms', true);               // Total: Time from POST to processed topic
const batchSubmitTime = new Trend('batch_submit_time_ms', true);
const rawTopicWaitTime = new Trend('raw_topic_wait_ms', true);
const processedTopicWaitTime = new Trend('processed_topic_wait_ms', true);
const rawMessagesGauge = new Gauge('raw_messages_count');
const processedMessagesGauge = new Gauge('processed_messages_count');
const httpErrors = new Counter('http_errors');
const timeouts = new Counter('timeouts');

// Test configuration - single iteration since we're doing batch processing
export const options = {
  vus: 1,
  iterations: 1,
  maxDuration: '10m',
  thresholds: {
    'cdc_api_response_ms': ['p(95)<100'],
    'cdc_http_to_raw_ms': ['p(95)<2000'],
    'cdc_raw_to_processed_ms': ['p(95)<1000'],
    'cdc_end_to_end_ms': ['p(95)<3000'],
    'http_errors': ['count==0'],
    'timeouts': ['count==0'],
  },
};

const KAFKA_BROKERS = ['localhost:9092'];
const RAW_TOPIC = 'events.events_development.event';
const PROCESSED_TOPIC = 'events.events_development.processedevent';
const API_ENDPOINT = 'http://localhost:4055/event/api';
const BATCH_SIZE = 100;  // Number of events to submit
const RAW_TOPIC_TIMEOUT_MS = 120000;  // 2 minutes
const PROCESSED_TOPIC_TIMEOUT_MS = 120000;  // 2 minutes from last raw message

export default function () {
  console.log(`Starting CDC latency test with batch size: ${BATCH_SIZE}`);

  // Step 1: Submit all messages in batch
  console.log('Step 1: Submitting batch of events...');
  const batchStartTime = Date.now();
  const eventIds = [];

  for (let i = 0; i < BATCH_SIZE; i++) {
    const correlationId = generateUUID();
    eventIds.push(correlationId);

    const payload = JSON.stringify({
      name: `k6_batch_test_${i}`,
      correlationId: correlationId,
      data: JSON.stringify({
        test: true,
        batch: true,
        index: i,
        timestamp: Date.now()
      }),
      timestamp: new Date().toISOString(),
      source: 'k6_cdc_batch_test',
      version: '1.0',
    });

    const response = http.post(API_ENDPOINT, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-Id': correlationId,
      },
      timeout: '5s',
    });

    const success = check(response, {
      'HTTP POST successful': (r) => r.status === 200 || r.status === 303 || r.status === 201,
    });

    if (!success) {
      console.error(`HTTP POST failed for event ${i}: ${response.status}`);
      httpErrors.add(1);
    }

    // Record API response time for each request
    apiResponseTime.add(response.timings.duration);
  }

  const batchSubmitDuration = Date.now() - batchStartTime;
  batchSubmitTime.add(batchSubmitDuration);
  console.log(`✓ Batch submission completed in ${batchSubmitDuration}ms (${BATCH_SIZE} events)`);

  // Step 2: Poll raw topic until we have BATCH_SIZE messages or timeout
  console.log(`Step 2: Polling raw topic for ${BATCH_SIZE} messages (timeout: ${RAW_TOPIC_TIMEOUT_MS}ms)...`);

  let rawReader;
  try {
    rawReader = new Reader({
      brokers: KAFKA_BROKERS,
      groupTopics: [RAW_TOPIC],
      groupID: `k6-raw-batch-${Date.now()}`,
      maxWait: '5s',
    });
    console.log('Raw Kafka reader initialized successfully');
  } catch (e) {
    console.error(`Failed to initialize raw Kafka reader: ${e}`);
    throw e;
  }

  const rawTopicStartTime = Date.now();
  let rawMessageCount = 0;
  const rawPollInterval = 500; // Poll every 500ms
  let rawTopicComplete = false;

  while (Date.now() - rawTopicStartTime < RAW_TOPIC_TIMEOUT_MS && !rawTopicComplete) {
    try {
      const messages = rawReader.consume({ limit: 100 });

      if (messages && messages.length > 0) {
        rawMessageCount += messages.length;
        console.log(`Raw topic: received ${messages.length} messages (total: ${rawMessageCount}/${BATCH_SIZE})`);
        rawMessagesGauge.add(rawMessageCount);
      }

      if (rawMessageCount >= BATCH_SIZE) {
        rawTopicComplete = true;
        break;
      }
    } catch (e) {
      console.log(`Kafka consume error (continuing): ${e.message || e}`);
      // Continue polling even if there's an error
    }

    if (!rawTopicComplete) {
      sleep(rawPollInterval / 1000);  // k6 sleep uses seconds
    }
  }

  if (rawMessageCount < BATCH_SIZE) {
    console.error(`⏱ TIMEOUT: Only found ${rawMessageCount}/${BATCH_SIZE} messages in raw topic`);
    timeouts.add(1);
    return;
  }

  // Calculate metrics after we have all raw messages
  const rawTopicDuration = Date.now() - rawTopicStartTime;
  rawTopicWaitTime.add(rawTopicDuration);
  debeziumLag.add(rawTopicDuration);
  console.log(`✓ All ${BATCH_SIZE} messages found in raw topic after ${rawTopicDuration}ms`);

  // Record timestamp when all raw messages received
  const tAllRaw = Date.now();

  // Step 3: Poll processed topic until we have BATCH_SIZE messages or timeout
  console.log(`Step 3: Polling processed topic for ${BATCH_SIZE} messages (timeout: ${PROCESSED_TOPIC_TIMEOUT_MS}ms)...`);

  let processedReader;
  try {
    processedReader = new Reader({
      brokers: KAFKA_BROKERS,
      groupTopics: [PROCESSED_TOPIC],
      groupID: `k6-processed-batch-${Date.now()}`,
      maxWait: '5s',
    });
    console.log('Processed Kafka reader initialized successfully');
  } catch (e) {
    console.error(`Failed to initialize processed Kafka reader: ${e}`);
    throw e;
  }

  const processedTopicStartTime = Date.now();
  let processedMessageCount = 0;
  const processedPollInterval = 500; // Poll every 500ms
  let lastMessageTime = Date.now();
  let processedTopicComplete = false;

  while (Date.now() - lastMessageTime < PROCESSED_TOPIC_TIMEOUT_MS && !processedTopicComplete) {
    try {
      const messages = processedReader.consume({ limit: 100 });

      if (messages && messages.length > 0) {
        processedMessageCount += messages.length;
        lastMessageTime = Date.now();
        console.log(`Processed topic: received ${messages.length} messages (total: ${processedMessageCount}/${BATCH_SIZE})`);
        processedMessagesGauge.add(processedMessageCount);
      }

      if (processedMessageCount >= BATCH_SIZE) {
        processedTopicComplete = true;
        break;
      }
    } catch (e) {
      console.log(`Kafka consume error (continuing): ${e.message || e}`);
      // Continue polling even if there's an error
    }

    if (!processedTopicComplete) {
      sleep(processedPollInterval / 1000);
    }
  }

  if (processedMessageCount < BATCH_SIZE) {
    console.error(`⏱ TIMEOUT: Only found ${processedMessageCount}/${BATCH_SIZE} messages in processed topic`);
    console.error(`   Last message received ${Date.now() - lastMessageTime}ms ago`);
    timeouts.add(1);
    return;
  }

  // Calculate metrics after we have all processed messages
  const processedTopicDuration = Date.now() - processedTopicStartTime;
  processedTopicWaitTime.add(processedTopicDuration);

  const processorLatency = Date.now() - tAllRaw;
  processorLag.add(processorLatency);

  const totalLatency = Date.now() - batchStartTime;
  endToEnd.add(totalLatency);

  console.log(`✓ All ${BATCH_SIZE} messages found in processed topic after ${processedTopicDuration}ms`);
  console.log(`\n📊 CDC Pipeline Metrics:`);
  console.log(`   Batch Submit Time:  ${batchSubmitDuration}ms`);
  console.log(`   Debezium Lag:       ${rawTopicDuration}ms (HTTP → Raw Topic)`);
  console.log(`   Processor Lag:      ${processorLatency}ms (Raw → Processed Topic)`);
  console.log(`   End-to-End:         ${totalLatency}ms (HTTP → Processed Topic)`);
}

// Helper: Generate UUID v4
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
