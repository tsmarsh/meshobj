import {RootConfig} from "@meshql/common";

export type StorageConfig = {type: "mongo" | "sql"} & (MongoConfig | SQLConfig);

export type MongoConfig = {
    uri: string;
    collection: string;
    db: string;
    options: {
        directConnection: boolean;
    };
}

export type SQLConfig = {
    uri: string;
    collection: string;
}

export type Graphlette = {
    path: string;
    storage: StorageConfig;
    schema: string;
    rootConfig: RootConfig
}

export type Restlette = {
    tokens?: string[];
    path: string;
    storage: StorageConfig;
    schema: Record<string, any>;
}

export type Config = {
    casbinParams?: string[]
    graphlettes: Graphlette[];
    port: number;
    restlettes: Restlette[];
}