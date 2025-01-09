import { Auth } from "@meshql/auth";
import Log4js from "log4js";
import { Envelope, Repository, Validator } from "@meshql/common";
import {FastifyReply, FastifyRequest} from "fastify";

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
        this._validator = validator;
    }

    create = async (req: FastifyRequest, reply: FastifyReply) => {
        const authTokens = await this.calculateTokens(req);
        const payload = req.body as any;

        if (!(await this._validator(payload))) {
            reply.status(400).send("Invalid document");
            return;
        }

        const doc: Envelope<I> = { payload, authorized_tokens: authTokens };
        const result: Envelope<I> = await this._repo.create(doc);

        if (result) {
            logger.debug(`Created: ${JSON.stringify(result)}`);
            reply.status(303).header("Location", `${this._context}/${result.id}`).send();
        } else {
            logger.error(`Failed to create: ${JSON.stringify(doc)}`);
            reply.status(400).send();
        }
    };

    private async calculateTokens(req: FastifyRequest): Promise<string[]> {
        return this._tokens.length > 0 ? this._tokens : await this._authorizer.getAuthToken(req);
    }

    read = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const id = req.params.id;
        const authToken = await this._authorizer.getAuthToken(req);
        const result = await this._repo.read(id);

        if (result) {
            reply.header("X-Canonical-Id", String(result.id));
            if (await this._authorizer.isAuthorized(authToken, result)) {
                reply.send(result.payload);
            } else {
                reply.status(403).send({});
            }
        } else {
            reply.status(404).send({});
        }
    };

    update = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const id = req.params.id;
        const authToken = await this._authorizer.getAuthToken(req);
        const payload = req.body as any;

        if (!(await this._validator(payload))) {
            reply.status(400).send("Invalid document");
            return;
        }

        const envelope: Envelope<I> = {
            id,
            payload,
            authorized_tokens: await this.calculateTokens(req),
        };

        const current = await this._repo.read(id);

        if (current) {
            if (await this._authorizer.isAuthorized(authToken, current)) {
                const result = await this._repo.create(envelope);
                logger.debug(`Updated: ${JSON.stringify(result)}`);
                reply.status(303).header("Location", `${this._context}/${result.id}`).send();
            } else {
                reply.status(403).send({});
            }
        } else {
            reply.status(404).send({});
        }
    };

    remove = async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        const id = req.params.id;
        const result = await this._repo.read(id);
        const tokens = await this._authorizer.getAuthToken(req);

        if (result) {
            if (await this._authorizer.isAuthorized(tokens, result)) {
                const success = await this._repo.remove(id);
                if (success) {
                    logger.debug(`Deleted: ${id}`);
                    reply.send({ deleted: id });
                } else {
                    reply.status(404).send({});
                }
            } else {
                reply.status(403).send({});
            }
        } else {
            reply.status(404).send({});
        }
    };

    list = async (_req: FastifyRequest, reply: FastifyReply) => {
        const results = await this._repo.list();
        reply.send(results.map((r) => `${this._context}/${r.id}`));
    };

    bulk_create = async (req: FastifyRequest, reply: FastifyReply) => {
        const docs = req.body as Record<string, any>[];
        const authorizedTokens = await this.calculateTokens(req);

        const envelopes: Envelope<I>[] = (
            await Promise.all(
                docs.map(async (d) => (await this._validator(d) ? { payload: d, authorized_tokens: authorizedTokens } : null))
            )
        ).filter(Boolean) as Envelope<I>[];

        const created = await this._repo.createMany(envelopes);
        reply.send(created.map(({ id }) => `${this._context}/${id}`));
    };

    bulk_read = async (req: FastifyRequest, reply: FastifyReply) => {
        const ids = (req.query as {ids: string}).ids.split(",");
        const authToken = await this._authorizer.getAuthToken(req);

        const found = await this._repo.readMany(ids);
        const authorizedDocs = found.filter((r) => this._authorizer.isAuthorized(authToken, r));

        reply.send(authorizedDocs.map((r) => r.payload));
    };
}