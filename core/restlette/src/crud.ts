import {Auth} from "@meshql/auth";
import {request, Request, Response} from "express";
import {authorizeResponse} from "./auth";
import Log4js from "log4js";
import {Envelope, Repository, Validator} from "@meshql/common";
import {context} from "@meshql/graphlette/src/graph/root";

const logger = Log4js.getLogger("meshql/restlette");

export class Crud<I> {
    private _authorizer: Auth;
    private _repo: Repository<I>;
    private readonly _context: string;
    private readonly _tokens: string[];
    private readonly _validator: Validator;

    constructor(authorizer: Auth, repo: Repository<I>, validator: Validator, context: string, tokens: string[] = []) {
        this._authorizer = authorizer;
        this._repo = repo;
        this._context = context;
        this._tokens = tokens;
        this._validator = validator
    }

     create = async (req: Request, res: Response) => {
        let auth_tokens = await this.calculateTokens(req);

         let payload = req.body;
         if(!await this._validator(payload)) {
             res.status(400).send("Invalid document");
             return
         }

         const doc: Envelope<I> = {payload: payload, authorized_tokens: auth_tokens};

        const result: Envelope<I> = await this._repo.create(doc);

        if (result !== null) {
            const auth_response = authorizeResponse(req, res);

            logger.debug(`Created: ${JSON.stringify(result)}`);
            auth_response.redirect(303, `${this._context}/${result.id}`);
        } else {
            logger.error(`Failed to create: ${JSON.stringify(doc)}`);
            res.sendStatus(400);
        }
    };

    private async calculateTokens(req: Request): Promise<string[]> {
        return this._tokens.length > 0 ? this._tokens : await this._authorizer.getAuthToken(req);
    }

    read = async (req: Request, res: Response)=> {
        const id = req.params.id;
        let authToken = await this._authorizer.getAuthToken(req);
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

        let authToken = await this._authorizer.getAuthToken(request);

        let payload = req.body;
        if(!await this._validator(payload)) {
            res.status(400).send("Invalid document");
            return
        }

        const envelope: Envelope<I> = {id: req.params.id, payload: payload, authorized_tokens: await this.calculateTokens(req)};

        const current:Envelope<I> = await this._repo.read(id);

        if (current !== null && current !== undefined) {
            if (await this._authorizer.isAuthorized(authToken, current)) {
                const result = await this._repo.create(envelope);

                const secured_response = authorizeResponse(req, res);

                logger.debug(`Updated: ${JSON.stringify(result)}`);
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
        const tokens = await this._authorizer.getAuthToken(request);

        if (result !== null && result !== undefined) {
            if (await this._authorizer.isAuthorized(tokens, result)) {
                let result: boolean = await this._repo.remove(id);
                if(result){
                    logger.debug(`Deleted: ${id}`);
                    res.json({deleted: id});
                } else {
                    res.status(404).json({});
                }
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

    bulk_create = async (req: Request, res: Response): Promise<void> => {
        const docs: Record<string, any>[] = req.body;
        const authorized_tokens = await this.calculateTokens(req);


        let envelopes: Envelope<I>[] = docs.filter(async d => await this._validator(d)).map( d => {return {
            payload: d,
            authorized_tokens
        }});

        const created = await this._repo.createMany(envelopes);

        created.map(({id}) => `${this._context}/${id}`);

        res.json(created);
    };

    bulk_read = async (req: Request, res: Response): Promise<void> => {
        const ids = (req.query.ids as string).split(",");
        let authToken = await this._authorizer.getAuthToken(request);

        const found = await this._repo.readMany(ids);

        const authorized_docs = found.filter((r) => this._authorizer.isAuthorized(authToken, r));
        res.json(authorized_docs.map((r) => r.payload));
    };
}