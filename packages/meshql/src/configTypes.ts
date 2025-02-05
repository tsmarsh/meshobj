import { RootConfig } from '@meshql/common';

export type PostgresConfig = {
    type: 'postgres';
    host: string;
    port: number;
    db: string;
    user: string;
    password: string;
    table: string;
};

export type StorageConfig = { type: 'mongo' | 'sql' | 'postgres' | 'mysql' } & (
    | PostgresConfig
    | MongoConfig
    | MySQLConfig
    | SQLConfig
);

export type MongoConfig = {
    uri: string;
    collection: string;
    db: string;
    options: {
        directConnection: boolean;
    };
};

export interface MySQLConfig {
    host: string;
    port: number;
    db: string;
    user: string;
    password: string;
    table: string;
}

export type SQLConfig = {
    uri: string;
    collection: string;
};

export type Graphlette = {
    path: string;
    storage: StorageConfig;
    schema: string;
    rootConfig: RootConfig;
};

export type Restlette = {
    tokens?: string[];
    path: string;
    storage: StorageConfig;
    schema: Record<string, any>;
};

export type Config = {
    casbinParams?: string[];
    graphlettes: Graphlette[];
    port: number;
    restlettes: Restlette[];
};
