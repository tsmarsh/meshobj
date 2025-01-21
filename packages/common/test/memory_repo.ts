import {Envelope, Id, Repository} from "../src";
import { v4 as uuidv4 } from "uuid";

export class InMemory implements Repository{
    db:Record<Id, Envelope> = {}

    async create(payload: Envelope, tokens: string[] = []): Promise<Envelope> {
        let id = uuidv4();
        payload["id"] = id;
        payload["created_at"] = new Date();
        this.db[id] = payload;
        return payload;
    }

    async createMany(payloads: Envelope[], tokens: string[] = []): Promise<Envelope[]> {
        return Promise.all(payloads.map(p => this.create(p, tokens)));
    }

    async list(tokens: string[] = []): Promise<Envelope[]> {
        return Object.values(this.db);
    }

    async read(id: Id, tokens: string[] = [], created_at: Date = new Date()): Promise<Envelope> {
        return this.db[id];
    }

    async readMany(ids: Id[], tokens: string[] = []): Promise<Envelope[]> {
        return Promise.all(ids.map(id => this.read(id, tokens)));
    }

    async remove(id: Id, tokens: string[] = []): Promise<boolean> {
        delete this.db[id]
        return true;
    }

    async removeMany(ids: Id[], tokens: string[] = []): Promise<Record<string, boolean>> {
        let r:Record<Id, boolean> = {};

        for (let id of ids){
            r[id] = await this.remove(id);
        }
        return r
    }
}
