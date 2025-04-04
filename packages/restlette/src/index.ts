import express, { RequestHandler, Router } from 'express';
import rateLimit from 'express-rate-limit';
import Log4js from 'log4js';
import swaggerUi, { JsonObject } from 'swagger-ui-express';
import { Crud } from './crud.js';
import { paths } from './swagger';

const logger = Log4js.getLogger('meshobj/restlette');

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
});

const swaggerOptions = (apiPath: string, port: number, schema: Record<string, any>) => ({
    openapi: '3.0.0',
    info: {
        version: '0.1.0',
        title: `${apiPath} API`,
        description: `API for mutating ${apiPath}`,
    },
    servers: [
        {
            url: `http://localhost:${port}`,
        },
    ],
    components: {
        securitySchemes: {
            BearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
            },
        },
        schemas: {
            State: schema,
            OperationStatus: {
                type: 'object',
                properties: {
                    id: {
                        type: 'string',
                    },
                    status: {
                        type: 'string',
                    },
                    error: {
                        type: 'string',
                    },
                },
            },
        },
    },
    paths: paths(apiPath),
});

export function init(
    app: express.Application,
    crud: Crud,
    apiPath: string,
    port: number,
    jsonSchema: Record<string, any>,
): express.Application {
    logger.info(`API Docs are available at: http://localhost:${port}${apiPath}/api-docs`);

    const swaggerDoc: JsonObject = swaggerOptions(apiPath, port, jsonSchema);
    const router = createRestletteRouter(apiPath, crud);

    app.use(limiter);
    app.use(apiPath, router);
    app.get(`${apiPath}/api-docs/swagger.json`, (req: express.Request, res: express.Response) => res.json(swaggerDoc));

    let handler: RequestHandler = swaggerUi.setup(swaggerDoc);

    app.use(`${apiPath}/api-docs`, swaggerUi.serve, handler);

    return app;
}

function createRestletteRouter(apiPath: string, crud: Crud): Router {
    const router = Router();

    router.post('/bulk', crud.bulk_create);
    router.get('/bulk', crud.bulk_read);
    router.post('/', crud.create);
    router.get('/', crud.list);
    router.get('/:id', crud.read);
    router.put('/:id', crud.update);
    router.delete('/:id', crud.remove);

    return router;
}

export { JSONSchemaValidator } from './validation';
export { Crud } from './crud';
