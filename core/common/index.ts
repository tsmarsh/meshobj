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

export type Envelope<I, D> = {
    id: Id<I>,
    payload: D
}

export interface Repository <I, D>{
    create: (payload: D) => Promise<Envelope<I, D>>;
    read: (id: Id<I>) => Promise<D>;
    list: () => Promise<Envelope<I, D>[]>;
    remove: (id: Id<I>) => Promise<boolean>;
    createMany: (payloads: D[]) => Promise<Envelope<I, D>[]>;
    readMany: (ids: Id<I>[]) => Promise<Envelope<I, D>[]>;
    removeMany: (ids: Id<I>[]) => Promise<Record<Id<I>, boolean>>;
}

export interface Searcher {
    find(queryTemplate: Handlebars.Template, args: Record<string, any>, timestamp?: number): Promise<Record<string, any>>;
    findAll(queryTemplate: Handlebars.Template, args: Record<string, any>, timestamp?: number): Promise<Record<string, any>[]>;
}