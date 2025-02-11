import { RootConfig } from '@meshobj/common';

export interface StorageConfig { type: string }

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
