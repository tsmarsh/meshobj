import {Envelope, Id, Repository} from "../src";

export class InMemory implements Repository<number>{
    db:Record<Id<number>, Envelope<number>> = {}
    sequence = 10;

    async create(payload: Envelope<number>, tokens: string[] = []): Promise<Envelope<number>> {
        let id = this.sequence++;
        payload["id"] = id;
        payload["created_at"] = new Date();
        this.db[id] = payload;
        return payload;
    }

    async createMany(payloads: Envelope<number>[], tokens: string[] = []): Promise<Envelope<number>[]> {
        return Promise.all(payloads.map(p => this.create(p, tokens)));
    }

    async list(tokens: string[] = []): Promise<Envelope<number>[]> {
        return Object.values(this.db);
    }

    async read(id: Id<number>, tokens: string[] = [], created_at: Date = new Date()): Promise<Envelope<number>> {
        return this.db[id];
    }

    async readMany(ids: Id<number>[], tokens: string[] = []): Promise<Envelope<number>[]> {
        return Promise.all(ids.map(id => this.read(id, tokens)));
    }

    async remove(id: Id<number>, tokens: string[] = []): Promise<boolean> {
        delete this.db[id]
        return true;
    }

    async removeMany(ids: Id<number>[], tokens: string[] = []): Promise<Record<number, boolean>> {
        let r:Record<Id<number>, boolean> = {};

        for (let id of ids){
            r[id] = await this.remove(id);
        }
        return r
    }
}
