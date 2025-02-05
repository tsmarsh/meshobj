import { MongoClient, Collection } from 'mongodb';
import { MongoConfig } from '../configTypes';
import { Envelope } from '@meshql/common';
import { MongoSearcher, MongoRepository } from '@meshql/mongo_repo';
import { Auth } from '@meshql/auth';
import { DTOFactory } from '@meshql/graphlette';

/**
 * Builds and returns a MongoDB Collection for the specified MongoConfig.
 */
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
