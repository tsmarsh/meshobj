import express, {RequestHandler, Router} from "express";
import Log4js from "log4js";
import swaggerUi, {JsonObject} from "swagger-ui-express";
import {Crud} from "./crud.js";

const logger = Log4js.getLogger("meshql/restlette");

export const paths = (context: string, schema: Record<string, any>,) => {
    return {
        [`${context}`]: {
            get: {
                operationId: "list",
                summary: "Lists all documents",
                security: [
                    {
                        BearerAuth: [],
                    },
                ],
                responses: {
                    200: {
                        description: "A list of documents",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "array",
                                    items: {
                                        type: "string",
                                    },
                                },
                            },
                        },
                    },
                },
            },
            post: {
                operationId: "create",
                summary: "Creates a document",
                security: [
                    {
                        BearerAuth: [],
                    },
                ],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                $ref: "#/components/schemas/State",
                            },
                        },
                    },
                },
                responses: {
                    303: {
                        description:
                            "The document was successfully created. You’ll be redirected to its URL.",
                    },
                    404: {
                        description: "A document with the specified ID was not found.",
                    },
                },
            },
        },
        [`${context}/{id}`]: {
            get: {
                summary: "Retrieves a document",
                operationId: "read",
                security: [
                    {
                        BearerAuth: [],
                    },
                ],
                parameters: [
                    {
                        in: "path",
                        name: "id",
                        required: true,
                        schema: {
                            type: "string",
                        },
                        description: "The ID of the document to retrieve.",
                    },
                ],
                responses: {
                    200: {
                        description: "The document was successfully retrieved.",
                        headers: {
                            "X-Canonical-Id": {
                                schema: {
                                    type: "string",
                                },
                            },
                        },
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: "#/components/schemas/State",
                                },
                            },
                        },
                    },
                    404: {
                        description: "A document with the specified ID was not found.",
                    },
                },
            },
            put: {
                summary: "Creates or updates a document",
                operationId: "update",
                security: [
                    {
                        BearerAuth: [],
                    },
                ],
                parameters: [
                    {
                        in: "path",
                        name: "id",
                        required: true,
                        schema: {
                            type: "string",
                        },
                        description: "The ID of the document to create or update.",
                    },
                ],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                $ref: "#/components/schemas/State",
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: "The document was successfully updated.",
                    },
                    201: {
                        description: "The document was successfully created.",
                        headers: {
                            Location: {
                                schema: {
                                    type: "string",
                                },
                                description: "URI of the created document.",
                            },
                        },
                    },
                },
            },
            delete: {
                summary: "Deletes a document",
                operationId: "delete",
                security: [
                    {
                        BearerAuth: [],
                    },
                ],
                parameters: [
                    {
                        in: "path",
                        name: "id",
                        required: true,
                        schema: {
                            type: "string",
                        },
                        description: "The ID of the document to delete.",
                    },
                ],
                responses: {
                    200: {
                        description: "The document was successfully deleted.",
                    },
                    404: {
                        description: "A document with the specified ID was not found.",
                    },
                },
            },
        },
        [`${context}/bulk`]: {
            get: {
                summary: "Retrieves all documents in bulk",
                operationId: "bulk_read",
                security: [
                    {
                        BearerAuth: [],
                    },
                ],
                responses: {
                    200: {
                        description: "The documents were successfully retrieved.",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "array",
                                    items: {
                                        $ref: "#/components/schemas/State",
                                    },
                                },
                            },
                        },
                    },
                },
            },
            post: {
                summary: "Creates multiple documents",
                operationId: "bulk_create",
                security: [
                    {
                        BearerAuth: [],
                    },
                ],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "array",
                                items: {
                                    $ref: "#/components/schemas/State",
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: "The documents were successfully created.",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        successful: {
                                            type: "array",
                                            items: {
                                                $ref: "#/components/schemas/OperationStatus",
                                            },
                                        },
                                        failed: {
                                            type: "array",
                                            items: {
                                                $ref: "#/components/schemas/OperationStatus",
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                },
            },
    };
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
    components: {
        securitySchemes: {
            BearerAuth: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT",
            },
        },
        schemas: {
            State: schema,
            OperationStatus: {
                type: "object",
                properties: {
                    id: {
                        type: "string",
                    },
                    status: {
                        type: "string",
                    },
                    error: {
                        type: "string",
                    },
                },
            },
        },
    },
    paths: paths(apiPath, schema),
});

export function init<I>(
    app: express.Application,
    crud: Crud<I>,
    apiPath: string,
    port: number,
    jsonSchema: Record<string, any>
): express.Application {
    logger.info(`API Docs are available at: http://localhost:${port}${apiPath}/api-docs`);

    const swaggerDoc: JsonObject = swaggerOptions(apiPath, port, jsonSchema);
    const router = createRestletteRouter(apiPath, crud);

    app.use(apiPath, router);
    app.get(`${apiPath}/api-docs/swagger.json`, (req:express.Request, res:express.Response) => res.json(swaggerDoc));

    let handler: RequestHandler = swaggerUi.setup(swaggerDoc);

    app.use(`${apiPath}/api-docs`, swaggerUi.serve, handler);

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
