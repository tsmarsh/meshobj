import { FastifyInstance } from "fastify";
import Log4js from "log4js";
import { Crud } from "./src/crud";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";

const logger = Log4js.getLogger("meshql/restlette");

// Initialization
const swaggerOptions = (context: string) => ({
    swagger: {
        info: {
            version: "0.1.0",
            title: `${context} API`,
            description: `API for mutating ${context}`,
        },
        host: "localhost:3000",
        basePath: `/${context}`,
    },
    exposeRoute: true,
    routePrefix: `/${context}/api-docs`,
});

export function init<I>(
    app: FastifyInstance,
    crud: Crud<I>,
    context: string
): FastifyInstance {
    logger.info(`API Docs are available at: ${context}/api-docs`);

    // Register Swagger for API documentation
    app.register(fastifySwagger, swaggerOptions(context));
    app.register(fastifySwaggerUi, {
        routePrefix: `${context}/api-docs`,
        uiConfig: {
            docExpansion: "list",
            deepLinking: false,
        },
        staticCSP: true,
        transformSpecificationClone: true,
    });

    // Routes
    app.post(`${context}/bulk`, crud.bulk_create);
    app.get(`${context}/bulk`, crud.bulk_read);

    app.post(`${context}`, crud.create);
    app.get(`${context}`, crud.list);
    app.get(`${context}/:id`, crud.read);
    app.put(`${context}/:id`, crud.update);
    app.delete(`${context}/:id`, crud.remove);

    return app;
}