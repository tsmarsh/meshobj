type Singleton = {
    query: string;
    name: string;
    id?: string;
}

type Vector = {
    query: string;
    name: string;
    id?: string;
}

type Resolver = {
    name: string;
    id: string;
    queryName: string;
    url: string;
}
type RootConfig = {
    singletons?: Singleton[];
    vectors?: Vector[];
    resolvers?: Resolver[]
}