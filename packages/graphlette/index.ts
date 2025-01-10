export {DTOFactory} from "./src/graph/dto"
export {context, root} from "./src/graph/root"
export {callSubgraph} from "./src/graph/subgraph"

import { FastifyInstance } from "fastify";
import mercurius from "mercurius";

export function init(app: FastifyInstance, schema: string, resolvers: Record<string, any>):FastifyInstance {
    app.register(mercurius, {
        schema,
        resolvers,
        graphiql: true,
    });


    return app;
}