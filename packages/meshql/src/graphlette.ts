import express from "express";
import { graphqlHTTP } from "express-graphql";
import { buildSchema } from "graphql";

export function init(app: express.Application, schema: string, path: string, resolvers: Record<string, any>): express.Application {
    // Convert the schema string to a GraphQL schema
    const graphqlSchema = buildSchema(schema);

    // Merge the schema with resolvers for execution
    const rootResolver = { ...resolvers };

    // Register the express-graphql middleware
    app.use(
        path,
        graphqlHTTP({
            schema: graphqlSchema,
            rootValue: rootResolver,
            graphiql: true, // Enable GraphiQL for testing
        })
    );

    return app;
}
