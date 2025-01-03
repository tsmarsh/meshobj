import {Auth} from "@meshql/auth";
import {request, Request, Response} from "express";
import {authorizeResponse} from "./auth";
import Log4js from "log4js";
import {Repo} from "./repo";

const logger = Log4js.getLogger("meshql/restlette");
export const create = (repo: Repo, context: string, authorizer: Auth) =>
    async (req: Request, res: Response) => {
        const doc = {payload: req.body};

        const secure_payload = authorizer.secureData(req, doc);

        const result = await repo.create(secure_payload);

        if (result !== null) {
            const auth_response = authorizeResponse(req, res);

            logger.debug(`Created: ${result}`);
            auth_response.redirect(303, `${context}/${result.id}`);
        } else {
            logger.error(`Failed to create: ${JSON.stringify(doc)}`);
            res.sendStatus(400);
        }
    };

export const read = (repo: Repo, authorizer: Auth) =>
    async (req: Request, res: Response) => {
        const id = req.params.id;
        let authToken = await authorizer.getAuthToken(request);
        const result = await repo.read(
            id,
            (data: Record<string, any>): Promise<boolean> => authorizer.isAuthorized(authToken, data),
            {}
        );

        if (result !== null && result !== undefined) {
            res.header("X-Canonical-Id", result.id);
            if (await authorizer.isAuthorized(req, result)) {
                authorizeResponse(req, res).json(result.payload);
            } else {
                res.status(403).json({});
            }
        } else {
            res.status(404).json({});
        }
    };

export const update = (repo: Repo, context: string, authorizer: Auth) => async (req: Request, res: Response) => {
    const payload = req.body;
    const id = req.params.id;

    const current = await repo.read(id, (data) => authorizer.isAuthorized(req, data), {});

    if (current !== null && current !== undefined) {
        if (await authorizer.isAuthorized(req, current)) {
            const secured_update = authorizer.secureData(req, {payload, id});

            const result = await repo.create(secured_update);

            const secured_response = authorizeResponse(req, res);

            logger.debug(`Updated: ${result}`);
            secured_response.redirect(303, `${context}/${id}`);
        } else {
            res.status(403).json({});
        }
    } else {
        res.status(404).json({});
    }
};

export const remove = (repo: Repo, authorizer: Auth) => async (req: Request, res: Response) => {
    const id = req.params.id;
    const result = await repo.read(
        id,
        (data) => authorizer.isAuthorized(req, data),
        {}
    );

    if (result !== null && result !== undefined) {
        if (await authorizer.isAuthorized(req, result)) {
            await repo.remove(id);
            logger.debug(`Deleted: ${id}`);
            res.json({deleted: id});
        } else {
            res.status(403).json({});
        }
    } else {
        res.status(404).json({});
    }
};

export const list = (repo: Repo, context: string, authorizer: Auth) => async (req: Request, res: Response) => {
    const results = await repo.list((query) => authorizer.secureRead(req, query));

    res.json(results.map((r) => `${context}/${r.id}`));
};