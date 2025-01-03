import express, {Application} from "express";

import Log4js from "log4js";
import {Auth} from "@meshql/auth";
import {Repo} from "./src/repo"

import {bulk_create, bulk_delete, bulk_read} from "./src/bulk";
import {create, list, read, remove, update} from "./src/crud";
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

export const init = (
    app: Application,
    authorizer: Auth,
    repo: Repo,
    context: string,
): Application => {
    logger.info(`API Docs are available on: ${context}/api-docs`);

    app.use(express.json());

    app.post(`${context}/bulk`, bulk_create(repo, context, authorizer));
    app.get(`${context}/bulk`, bulk_read(repo, authorizer));
    app.delete(`${context}/bulk`, bulk_delete(repo));

    app.post(`${context}`, create(repo, context, authorizer));
    app.get(`${context}`, list(repo, context, authorizer));
    app.get(`${context}/:id`, read(repo, authorizer));
    app.put(`${context}/:id`, update(repo, context, authorizer));
    app.delete(`${context}/:id`, remove(repo, authorizer));

    //expressJSDocSwagger(app)(options(context));

    return app;
};