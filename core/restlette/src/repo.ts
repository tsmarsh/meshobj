import {ReadSecurer} from "@meshql/auth";

export type Id<I> = string | number;

export type Envelope<I, D> = {
    id: Id<I>,
    payload: D
}

export interface Repo <I, D>{
    create: (payload: D) => Promise<Envelope<I, D>>;
    read: (id: Id<I>) => Promise<D>;
    list: () => Promise<Envelope<I, D>[]>;
    remove: (id: Id<I>) => Promise<boolean>;
    createMany: (payloads: D[]) => Promise<Envelope<I, D>[]>;
    readMany: (ids: Id<I>[]) => Promise<Envelope<I, D>[]>;
    removeMany: (ids: Id<I>[]) => Promise<Record<Id<I>, boolean>>;
}

export class InMemory implements Repo<number, Record<string, any>>{
    db:Record<Id<number>, Envelope<number, Record<string, any>>> = {}
    sequence = 10;

    async create(payload: any): Promise<Envelope<number, Record<string, any>>> {
        let id = this.sequence++;
        payload["id"] = id;
        this.db[id] = {id, payload};
        return payload;
    }

    async createMany(payloads: any[]): Promise<Envelope<number, Record<string, any>>[]> {
        return Promise.all(payloads.map(this.create));
    }

    async list(): Promise<Envelope<number, Record<string, any>>[]> {
        return Object.values(this.db);
    }

    async read(id: Id<number>): Promise<Envelope<number, Record<string, any>>> {
        return this.db[id];
    }

    async readMany(ids: Id<number>[]): Promise<Envelope<number, Record<string, any>>[]> {
        return Promise.all(ids.map(this.read))
    }

    async remove(id: Id<number>): Promise<boolean> {
        delete this.db[id]
        return true;
    }

    async removeMany(ids: Id<number>[]): Promise<Record<number, boolean>> {
        let r:Record<Id<number>, boolean> = {};

        for (let id in ids){
            r[id] = await this.remove(id);
        }
        return r
    }
}