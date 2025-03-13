export { MongoSearcher } from './mongoSearcher.js';
export { MongoRepository } from './mongoRepo.js';

import { MongoSearcher } from './mongoSearcher.js';
import { MongoRepository } from './mongoRepo.js';
import { MongoClient, Collection } from 'mongodb';
import { StorageConfig } from '@meshobj/server';
import { Envelope } from '@meshobj/common';
import { Auth } from '@meshobj/auth';
import { DTOFactory } from '@meshobj/graphlette';
import { Plugin } from '@meshobj/server';
/**
 * Builds and returns a MongoDB Collection for the specified MongoConfig.
 */

export interface MongoConfig extends StorageConfig {
    uri: string;
    collection: string;
    db: string;
    options: {
        directConnection: boolean;
    };
}

export async function buildMongoCollection(
    mongoConfig: MongoConfig,
    clients: Record<string, MongoClient>,
): Promise<Collection<Envelope>> {
    if (!clients[mongoConfig.uri]) {
        const client = new MongoClient(mongoConfig.uri);
        await client.connect();
        clients[mongoConfig.uri] = client;
    }

    const mongoDb = clients[mongoConfig.uri].db(mongoConfig.db);
    return mongoDb.collection<Envelope>(mongoConfig.collection);
}

export class MongoPlugin implements Plugin {
    private clients: Record<string, MongoClient>;

    constructor() {
        this.clients = {};
    }
    async createRepository(config: StorageConfig) {
        return createMongoRepository(config as MongoConfig, this.clients);
    }

    async createSearcher(config: StorageConfig, dtoFactory: DTOFactory, auth: Auth) {
        return createMongoSearcher(config as MongoConfig, dtoFactory, auth, this.clients);
    }

    async cleanup() {
        for (const client of Object.values(this.clients)) {
            await client.close();
        }
    }
}
/**
 * Creates a MongoSearcher with the given config, DTO factory, and auth.
 */
export async function createMongoSearcher(
    mongoConfig: MongoConfig,
    dtoFactory: DTOFactory,
    auth: Auth,
    clients: Record<string, MongoClient>,
) {
    const collection = await buildMongoCollection(mongoConfig, clients);
    return new MongoSearcher(collection, dtoFactory, auth);
}

/**
 * Creates a MongoRepository with the given config.
 */
export async function createMongoRepository(mongoConfig: MongoConfig, clients: Record<string, MongoClient>) {
    const collection = await buildMongoCollection(mongoConfig, clients);
    return new MongoRepository(collection);
}
