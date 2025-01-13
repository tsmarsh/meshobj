import {FastifyInstance} from "fastify";
import mercurius from "mercurius";

export function init(app: FastifyInstance, schema: string, path, resolvers: Record<string, any>):FastifyInstance {
    app.register((instance, opts, done) => {
        instance.register(mercurius, {
            path,
            schema,
            resolvers,
            graphiql: true,
        })
        done();
    })
    return app;
}