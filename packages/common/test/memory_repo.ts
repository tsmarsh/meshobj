import {Envelope, Id, Repository} from "../src";
import { v4 as uuidv4 } from "uuid";

export class InMemory implements Repository<string>{
    db:Record<Id<string>, Envelope<string>> = {}

    async create(payload: Envelope<string>, tokens: string[] = []): Promise<Envelope<string>> {
        let id = uuidv4();
        payload["id"] = id;
        payload["created_at"] = new Date();
        this.db[id] = payload;
        return payload;
    }

    async createMany(payloads: Envelope<string>[], tokens: string[] = []): Promise<Envelope<string>[]> {
        return Promise.all(payloads.map(p => this.create(p, tokens)));
    }

    async list(tokens: string[] = []): Promise<Envelope<string>[]> {
        return Object.values(this.db);
    }

    async read(id: Id<string>, tokens: string[] = [], created_at: Date = new Date()): Promise<Envelope<string>> {
        return this.db[id];
    }

    async readMany(ids: Id<string>[], tokens: string[] = []): Promise<Envelope<string>[]> {
        return Promise.all(ids.map(id => this.read(id, tokens)));
    }

    async remove(id: Id<string>, tokens: string[] = []): Promise<boolean> {
        delete this.db[id]
        return true;
    }

    async removeMany(ids: Id<string>[], tokens: string[] = []): Promise<Record<string, boolean>> {
        let r:Record<Id<string>, boolean> = {};

        for (let id of ids){
            r[id] = await this.remove(id);
        }
        return r
    }
}
