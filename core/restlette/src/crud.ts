import {Auth} from "@meshql/auth";
import {request, Request, Response} from "express";
import {authorizeResponse} from "./auth";
import Log4js from "log4js";
import {Envelope, Repo} from "./repo";

const logger = Log4js.getLogger("meshql/restlette");

export class Crud<I> {
    private _authorizer: Auth;
    private _repo: Repo<I, Record<string, any>>;
    private readonly _context: string;

    constructor(authorizer: Auth, repo: Repo<I, Record<string, any>>, context: string) {
        this._authorizer = authorizer;
        this._repo = repo;
        this._context = context;

    }

    async create(req: Request, res: Response) {
        const doc:{payload: Record<string, any>} = {payload: req.body};

        const result: Envelope<I, Record<string, any>> = await this._repo.create(doc);

        if (result !== null) {
            const auth_response = authorizeResponse(req, res);

            logger.debug(`Created: ${result}`);
            auth_response.redirect(303, `${this._context}/${result.id}`);
        } else {
            logger.error(`Failed to create: ${JSON.stringify(doc)}`);
            res.sendStatus(400);
        }
    };

    async read(req: Request, res: Response) {
        const id = req.params.id;
        let authToken = await this._authorizer.getAuthToken(request);
        const result = await this._repo.read(id);

        if (result !== null && result !== undefined) {
            res.header("X-Canonical-Id", result.id);
            if (await this._authorizer.isAuthorized(req, result)) {
                authorizeResponse(req, res).json(result.payload);
            } else {
                res.status(403).json({});
            }
        } else {
            res.status(404).json({});
        }
    };

    async update(req: Request, res: Response) {
        const payload = req.body;
        const id = req.params.id;

        const current = await this._repo.read(id);

        if (current !== null && current !== undefined) {
            if (await this._authorizer.isAuthorized(req, current)) {
                const result = await this._repo.create({payload, id});

                const secured_response = authorizeResponse(req, res);

                logger.debug(`Updated: ${result}`);
                secured_response.redirect(303, `${this._context}/${id}`);
            } else {
                res.status(403).json({});
            }
        } else {
            res.status(404).json({});
        }
    };

    async remove(req: Request, res: Response) {
        const id = req.params.id;
        const result = await this._repo.read(id);

        if (result !== null && result !== undefined) {
            if (await this._authorizer.isAuthorized(req, result)) {
                await this._repo.remove(id);
                logger.debug(`Deleted: ${id}`);
                res.json({deleted: id});
            } else {
                res.status(403).json({});
            }
        } else {
            res.status(404).json({});
        }
    };

    async list(req: Request, res: Response) {
        const results = await this._repo.list();

        res.json(results.map((r) => `${this._context}/${r.id}`));
    }
}