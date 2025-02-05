import { FieldNode, GraphQLSchema, SelectionSetNode } from 'graphql';
export declare const callSubgraph: (url: URL, query: string, queryName: string, authHeader: string | null) => Promise<Record<string, any>>;
export declare const processSelectionSet: (selectionSet: SelectionSetNode) => string;
export declare const processFieldNode: (field: FieldNode) => string;
export declare const addTimestampToQuery: (query: string, schema: GraphQLSchema, queryName: string, timestamp: number) => string;
export declare const processContext: (id: any, context: any, queryName: string, timestamp: number) => string;
//# sourceMappingURL=subgraph.d.ts.map