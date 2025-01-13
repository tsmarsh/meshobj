import express, { Router } from "express";
import Log4js from "log4js";
import swaggerUi from "swagger-ui-express";
import { Crud } from "./src/crud";

const logger = Log4js.getLogger("meshql/restlette");

const schemas = (apiPath: string, schema: Record<string, any>): Record<string, any> => {
    const paths: Record<string, any> = {};

    paths[`${apiPath}/bulk`] = {
        post: {
            description: "Bulk create items",
            tags: [apiPath],
            requestBody: {
                content: {
                    "application/json": {
                        schema: { type: "array", items: schema },
                    },
                },
            },
            responses: {
                200: {
                    description: "Successful response",
                    content: {
                        "application/json": {
                            schema: { type: "array", items: schema },
                        },
                    },
                },
            },
        },
        get: {
            description: "Bulk read items",
            tags: [apiPath],
            responses: {
                200: {
                    description: "Successful response",
                    content: {
                        "application/json": {
                            schema: { type: "array", items: schema },
                        },
                    },
                },
            },
        },
    };

    paths[apiPath] = {
        post: {
            description: "Create an item",
            tags: [apiPath],
            requestBody: {
                content: {
                    "application/json": {
                        schema,
                    },
                },
            },
            responses: {
                201: {
                    description: "Item created successfully",
                    content: {
                        "application/json": {
                            schema,
                        },
                    },
                },
            },
        },
        get: {
            description: "List items",
            tags: [apiPath],
            responses: {
                200: {
                    description: "Successful response",
                    content: {
                        "application/json": {
                            schema: { type: "array", items: schema },
                        },
                    },
                },
            },
        },
    };

    paths[`${apiPath}/{id}`] = {
        get: {
            description: "Read an item",
            tags: [apiPath],
            parameters: [
                {
                    name: "id",
                    in: "path",
                    required: true,
                    schema: { type: "string" },
                },
            ],
            responses: {
                200: {
                    description: "Successful response",
                    content: {
                        "application/json": {
                            schema,
                        },
                    },
                },
            },
        },
        put: {
            description: "Update an item",
            tags: [apiPath],
            parameters: [
                {
                    name: "id",
                    in: "path",
                    required: true,
                    schema: { type: "string" },
                },
            ],
            requestBody: {
                content: {
                    "application/json": {
                        schema,
                    },
                },
            },
            responses: {
                200: {
                    description: "Item updated successfully",
                    content: {
                        "application/json": {
                            schema,
                        },
                    },
                },
            },
        },
        delete: {
            description: "Remove an item",
            tags: [apiPath],
            parameters: [
                {
                    name: "id",
                    in: "path",
                    required: true,
                    schema: { type: "string" },
                },
            ],
            responses: {
                204: {
                    description: "Item removed successfully",
                },
            },
        },
    };

    return paths;
};

const swaggerOptions = (apiPath: string, port: number, schema: Record<string, any>) => ({
    openapi: "3.0.0",
    info: {
        version: "0.1.0",
        title: `${apiPath} API`,
        description: `API for mutating ${apiPath}`,
    },
    servers: [
        {
            url: `http://localhost:${port}${apiPath}`,
        },
    ],
    paths: schemas(apiPath, schema),
});

export function init<I>(
    app: express.Application,
    crud: Crud<I>,
    apiPath: string,
    port: number,
    jsonSchema: Record<string, any>
): express.Application {
    logger.info(`API Docs are available at: http://localhost:${port}${apiPath}/api-docs`);

    const swaggerDoc = swaggerOptions(apiPath, port, jsonSchema);
    const router = createRestletteRouter(apiPath, crud);

    app.use(apiPath, router);
    app.get(`${apiPath}/api-docs/swagger.json`, (req:Request, res:Response) => res.json(swaggerDoc));
    app.use(`${apiPath}/api-docs`, swaggerUi.serve, swaggerUi.setup(swaggerDoc));

    return app;
}

function createRestletteRouter<I>(apiPath: string, crud: Crud<I>): Router {
    const router = Router();

    router.post("/bulk", crud.bulk_create);
    router.get("/bulk", crud.bulk_read);
    router.post("/", crud.create);
    router.get("/", crud.list);
    router.get("/:id", crud.read);
    router.put("/:id", crud.update);
    router.delete("/:id", crud.remove);

    return router;
}