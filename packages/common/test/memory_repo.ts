import { Envelope, Id, Repository } from "../src";
import { v4 as uuidv4 } from "uuid";

export class InMemory implements Repository {
    db: Record<Id, Envelope[]> = {};

    async create(payload: Envelope, tokens: string[] = []): Promise<Envelope> {
        let id = payload.id || uuidv4();
        payload["id"] = id;
        payload["created_at"] = new Date();
        payload["authorized_tokens"] = tokens;
        payload["deleted"] = false;

        if (this.db[id]) {
            this.db[id].push(payload);
        } else {
            this.db[id] = [payload];
        }

        return payload;
    }

    async createMany(payloads: Envelope[], tokens: string[] = []): Promise<Envelope[]> {
        return Promise.all(payloads.map(p => this.create(p, tokens)));
    }

    async list(tokens: string[] = []): Promise<Envelope[]> {
        const result: Envelope[] = [];
        const seen = new Set<Id>();

        for (const envList of Object.values(this.db)) {
            // Filter out deleted envelopes
            const nonDeletedEnvelopes = envList.filter(e => !e.deleted);
            if (nonDeletedEnvelopes.length > 0) {
                // Sort by created_at descending to get the latest version
                nonDeletedEnvelopes.sort((a, b) => b.created_at!.getTime() - a.created_at!.getTime());
                const latestEnvelope = nonDeletedEnvelopes[0];

                // Add the latest envelope if it hasn't been added yet
                if (!seen.has(latestEnvelope.id)) {
                    seen.add(latestEnvelope.id);
                    result.push(latestEnvelope);
                }
            }
        }
        return result;
    }

    async read(id: Id, tokens: string[] = [], created_at: Date = new Date()): Promise<Envelope | undefined> {
        const envelopes = this.db[id];
        if (!envelopes) return undefined;

        // Find the latest envelope that is not deleted and created before or at the specified timestamp
        return envelopes
            .filter(e => e.created_at!.getTime() <= created_at.getTime() && e.deleted === false)
            .sort((a, b) => b.created_at!.getTime() - a.created_at!.getTime())[0]; // Sort by created_at descending and return the first
    }

    async readMany(ids: Id[], tokens: string[] = []): Promise<Envelope[]> {
        let many = await Promise.all(ids.map(id => this.read(id, tokens)));
        return many.filter(e => e !== undefined);
    }

    async remove(id: Id, tokens: string[] = []): Promise<boolean> {
        if (!this.db[id]) return false;

        this.db[id] = this.db[id].map(e => {
            e.deleted = true;
            return e;
        });
        return true;
    }

    async removeMany(ids: Id[], tokens: string[] = []): Promise<Record<string, boolean>> {
        let r: Record<Id, boolean> = {};

        for (let id of ids) {
            r[id] = await this.remove(id);
        }
        return r;
    }
}