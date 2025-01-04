import express, {Application} from "express";

import Log4js from "log4js";

import {Bulk} from "./src/bulk";
import {Crud} from "./src/crud";
import expressJSDocSwagger from "express-jsdoc-swagger";

const logger = Log4js.getLogger("meshql/restlette");


// Initialization
const options = (context: string) => {
    return {
        info: {
            version: "0.1.0",
            title: `${context} API`,
            description: `API for mutating ${context}`,
        },
        baseDir: __dirname,
        filesPattern: "./**/*.ts", // Match your TypeScript files
        swaggerUIPath: `${context}/api-docs`,
        exposeSwaggerUI: true,
        exposeApiDocs: true,
        apiDocsPath: `${context}/api-docs/swagger.json`,
    }
};

export function init<I>(app: Application, crud: Crud<I>, bulk: Bulk<I>, context: string,): Application {
    logger.info(`API Docs are available on: ${context}/api-docs`);

    app.use(express.json());

    app.post(`${context}/bulk`, bulk.bulk_create);
    app.get(`${context}/bulk`, bulk.bulk_read);
    app.delete(`${context}/bulk`, bulk.bulk_delete);

    app.post(`${context}`, crud.create);
    app.get(`${context}`, crud.list);
    app.get(`${context}/:id`, crud.read);
    app.put(`${context}/:id`, crud.update);
    app.delete(`${context}/:id`, crud.remove);

    //expressJSDocSwagger(app)(options(context));

    return app;
}