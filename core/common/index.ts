import {TemplateDelegate} from "handlebars";

export * from "./certification/repository.cert"
export * from "./certification/searcher.cert"

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

export type Id<I> = string | number;

export type Payload = Record<string, any>;

export type Envelope<I> = {
    id?: Id<I>;
    payload: Payload;
    createdAt?: Date;
    deleted?: boolean;
}



export interface Repository <I>{
    create: (envelope: Envelope<I>, tokens?: string[]) => Promise<Envelope<I>>;
    read: (id: Id<I>, tokens?: string[], createdAt?: Date) => Promise<Envelope<I>>;
    list: (tokens?: string[]) => Promise<Envelope<I>[]>;
    remove: (id: Id<I>, tokens?: string[]) => Promise<boolean>;
    createMany: (payloads: Envelope<I>[], tokens?: string[]) => Promise<Envelope<I>[]>;
    readMany: (ids: Id<I>[], tokens?: string[]) => Promise<Envelope<I>[]>;
    removeMany: (ids: Id<I>[], tokens?: string[]) => Promise<Record<Id<I>, boolean>>;
}

export interface Searcher<I> {
    find<I>(queryTemplate: TemplateDelegate, args: Record<string, any>, creds?: string[], timestamp?: number): Promise<Record<string, any>>;
    findAll<I>(queryTemplate: TemplateDelegate, args: Record<string, any>, creds?: string[],timestamp?: number): Promise<Record<string, any>[]>;
}