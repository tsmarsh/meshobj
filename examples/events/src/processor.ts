import { Kafka, logLevel } from 'kafkajs';
import axios from 'axios';

type DebeziumVal = any; // Keep loose; we parse defensively

const KAFKA_BROKER = process.env.KAFKA_BROKER ?? 'localhost:9092';
const RAW_TOPIC = process.env.RAW_TOPIC!;
const PROCESSED_API_BASE = process.env.PROCESSED_API_BASE ?? 'http://localhost:4055/processedevent/api';

function isInsert(val: DebeziumVal): boolean {
    // Debezium Server for Mongo can present either:
    // 1) envelope: { op: 'c'|'u'|'d', after: {...}, source:{...} }
    // 2) flattened but still with op/after
    const op = val?.op ?? val?.payload?.op;
    return op === 'c' || op === 'create' || op === 'insert';
}

function extractAfter(val: DebeziumVal): any {
    return val?.after ?? val?.payload?.after ?? null;
}

// Very basic "processing" — enrich + echo some fields
function buildProcessedEvent(after: any) {
    const raw_event_id = String(after?._id ?? after?.id ?? '').replace(/^ObjectId\((.+)\)$/, '$1');
    const name = String(after?.name ?? 'unknown');

    // You declared processed_data as string; stringify here
    const processed_data = JSON.stringify({
        user_id: after?.data?.user_id ?? null,
        username: after?.data?.username ?? null,
        source: after?.source ?? null,
        original: after
    });

    return {
        id: crypto.randomUUID(),
        raw_event_id,
        name,
        processed_data,
        processed_timestamp: new Date().toISOString(),
        processing_time_ms: Math.round(Math.random() * 10) + 5,
        status: 'SUCCESS' as const
    };
}

export class RawToProcessedProcessor {
    private kafka = new Kafka({
        clientId: 'events-e2e-processor',
        brokers: [KAFKA_BROKER],
        logLevel: logLevel.NOTHING
    });

    private running = false;

    async start() {
        if (this.running) return;
        this.running = true;

        const consumer = this.kafka.consumer({ groupId: `events-e2e-processor-${Date.now()}` });
        await consumer.connect();
        await consumer.subscribe({ topic: RAW_TOPIC, fromBeginning: true });

        await consumer.run({
            eachMessage: async ({ message }: { message: any }) => {
                if (!this.running) return;
                try {
                    const text = message.value?.toString('utf8') ?? '{}';
                    const val = JSON.parse(text);

                    if (!isInsert(val)) return;

                    // Optional: filter to expected db/collection in case Debezium publishes multiple
                    // const db = extractDb(val); const coll = extractColl(val);
                    // if (db !== 'events_development' || coll !== 'events-development-event') return;

                    const after = extractAfter(val);
                    if (!after) return;

                    // require some “name” to avoid noise
                    if (!after.name) return;

                    const processed = buildProcessedEvent(after);

                    await axios.post(PROCESSED_API_BASE, processed, {
                        headers: { 'Content-Type': 'application/json' },
                        // retry-ish (keep it simple)
                        timeout: 5000
                    });
                } catch (err) {
                    // Swallow in test processor; log for debugging
                    // console.error('processor error', err);
                }
            }
        });

        // keep a reference to allow stop()
        (this as any)._consumer = consumer;
    }

    async stop() {
        this.running = false;
        const consumer = (this as any)._consumer;
        if (consumer) {
            try {
                await consumer.disconnect();
            } catch {
                // Ignore disconnect errors during cleanup
            }
            (this as any)._consumer = undefined;
        }
    }
}