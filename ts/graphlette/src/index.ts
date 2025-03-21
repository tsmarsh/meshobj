export { DTOFactory } from './graph/dto.js';
export { context, root } from './graph/root.js';
export { callSubgraph } from './graph/subgraph.js';

import { Application } from 'express';
import { graphqlHTTP } from 'express-graphql';
import { buildSchema } from 'graphql';

export function init(app: Application, schema: string, path: string, rootValue: Record<string, any>): Application {
    const graphqlSchema = buildSchema(schema);

    app.use(
        path,
        graphqlHTTP({
            schema: graphqlSchema,
            rootValue,
            graphiql: true,
            customFormatErrorFn: (error) => ({
                message: error.message,
                locations: error.locations,
                path: error.path,
            }),
        }),
    );

    return app;
}
