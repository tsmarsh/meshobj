import {Auth} from "@meshql/auth";
import {request, Request, Response} from "express";
import {authorizeResponse} from "./auth";
import Log4js from "log4js";
import {Envelope, Repository} from "@meshql/common";

const logger = Log4js.getLogger("meshql/restlette");

export class Crud<I> {
    private _authorizer: Auth;
    private _repo: Repository<I>;
    private readonly _context: string;

    constructor(authorizer: Auth, repo: Repository<I>, context: string) {
        this._authorizer = authorizer;
        this._repo = repo;
        this._context = context;
    }

     create = async (req: Request, res: Response) => {
        const doc: Envelope<I> = {payload: req.body};

        const result: Envelope<I> = await this._repo.create(doc);

        if (result !== null) {
            const auth_response = authorizeResponse(req, res);

            logger.debug(`Created: ${result}`);
            auth_response.redirect(303, `${this._context}/${result.id}`);
        } else {
            logger.error(`Failed to create: ${JSON.stringify(doc)}`);
            res.sendStatus(400);
        }
    };

    read = async (req: Request, res: Response)=> {
        const id = req.params.id;
        let authToken = await this._authorizer.getAuthToken(request);
        const result = await this._repo.read(id);

        if (result !== null && result !== undefined) {
            res.header("X-Canonical-Id", String(result.id));
            if (await this._authorizer.isAuthorized(authToken, result)) {
                authorizeResponse(req, res).json(result.payload);
            } else {
                res.status(403).json({});
            }
        } else {
            res.status(404).json({});
        }
    };

    update = async (req: Request, res: Response) => {
        const id = req.params.id;

        const payload: Envelope<I> = {id: req.params.id, payload: req.body};

        const current:Envelope<I> = await this._repo.read(id);

        if (current !== null && current !== undefined) {
            if (await this._authorizer.isAuthorized(req, current)) {
                const result = await this._repo.create(payload);

                const secured_response = authorizeResponse(req, res);

                logger.debug(`Updated: ${result}`);
                secured_response.redirect(303, `${this._context}/${result.id}`);
            } else {
                res.status(403).json({});
            }
        } else {
            res.status(404).json({});
        }
    };

    remove = async (req: Request, res: Response) => {
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

    list = async (req: Request, res: Response) => {
        const results = await this._repo.list();

        res.json(results.map((r) => `${this._context}/${r.id}`));
    }
}