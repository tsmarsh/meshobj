export { DTOFactory } from './graph/dto.js';
export { context, root } from './graph/root.js';
export { callSubgraph } from './graph/subgraph.js';
import { graphqlHTTP } from 'express-graphql';
import { buildSchema } from 'graphql';
export function init(app, schema, path, rootValue) {
    const graphqlSchema = buildSchema(schema);
    app.use(path, graphqlHTTP({
        schema: graphqlSchema,
        rootValue,
        graphiql: true,
        customFormatErrorFn: (error) => ({
            message: error.message,
            locations: error.locations,
            path: error.path,
        }),
    }));
    return app;
}
