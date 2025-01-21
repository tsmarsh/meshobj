import {TemplateDelegate} from "handlebars";

export type Singleton = {
    query: string;
    name: string;
    id?: string;
}

export type Vector = {
    query: string;
    name: string;
    id?: string;
}

export type Resolver = {
    name: string;
    id: string;
    queryName: string;
    url: string;
}

export type RootConfig = {
    singletons?: Singleton[];
    vectors?: Vector[];
    resolvers?: Resolver[]
}

export type Id = string | number;

export type Payload = Record<string, any>;

export type Envelope = {
    id?: Id;
    payload: Payload;
    created_at?: Date;
    deleted?: boolean;
    authorized_tokens?: string[]
}



export interface Repository{
    create: (envelope: Envelope, tokens?: string[]) => Promise<Envelope>;
    read: (id: Id, tokens?: string[], createdAt?: Date) => Promise<Envelope>;
    list: (tokens?: string[]) => Promise<Envelope[]>;
    remove: (id: Id, tokens?: string[]) => Promise<boolean>;
    createMany: (payloads: Envelope[], tokens?: string[]) => Promise<Envelope[]>;
    readMany: (ids: Id[], tokens?: string[]) => Promise<Envelope[]>;
    removeMany: (ids: Id[], tokens?: string[]) => Promise<Record<Id, boolean>>;
}

export interface Searcher {
    find(queryTemplate: TemplateDelegate, args: Record<string, any>, creds?: string[], timestamp?: number): Promise<Record<string, any>>;
    findAll(queryTemplate: TemplateDelegate, args: Record<string, any>, creds?: string[],timestamp?: number): Promise<Record<string, any>[]>;
}

export interface Validator {
    (data: Record<string, any>): Promise<boolean>
}