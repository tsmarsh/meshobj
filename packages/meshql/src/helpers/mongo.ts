import { MongoClient, Collection } from "mongodb";
import { MongoConfig } from "../configTypes";
import { Envelope } from "@meshql/common";
import { MongoSearcher, MongoRepository } from "@meshql/mongo_repo";
import { Auth } from "@meshql/auth";
import { DTOFactory } from "@meshql/graphlette";

/**
 * Builds and returns a MongoDB Collection for the specified MongoConfig.
 */
export async function buildMongoCollection(mongoConfig: MongoConfig): Promise<Collection<Envelope>> {
    const client = new MongoClient(mongoConfig.uri);
    await client.connect();
    const mongoDb = client.db(mongoConfig.db);
    return mongoDb.collection<Envelope>(mongoConfig.collection);
}

/**
 * Creates a MongoSearcher with the given config, DTO factory, and auth.
 */
export async function createMongoSearcher(mongoConfig: MongoConfig, dtoFactory: DTOFactory, auth: Auth) {
    const collection = await buildMongoCollection(mongoConfig);
    return new MongoSearcher(collection, dtoFactory, auth);
}

/**
 * Creates a MongoRepository with the given config.
 */
export async function createMongoRepository(mongoConfig: MongoConfig) {
    const collection = await buildMongoCollection(mongoConfig);
    return new MongoRepository(collection);
} 