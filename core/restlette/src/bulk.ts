import {Auth} from "@meshql/auth";
import {Request, Response} from "express";

import {Repo} from "./repo";
import {context} from "@meshql/graphlette/src/graph/root";

export class Bulk<I, T> {
    private _authorizer: Auth;
    private _repo: Repo<I, T>;
    private _context: string;
    constructor(authorizer: Auth, repo: Repo<I, T>, context: string) {
        this._authorizer = authorizer;
        this._repo = repo;
        this._context = context;
    }
    async bulk_create(req: Request, res: Response): Promise<void> {
        const docs = req.body;

        const created = await this._repo.createMany(docs);

        created.map(({id}) => `${context}/${id}`);

        res.json(created);
    };

    async bulk_read(req: Request, res: Response): Promise<void> {
        const ids = (req.query.ids as string).split(",");

        const found = await this._repo.readMany(ids);

        const authorized_docs = found.filter((r) => this._authorizer.isAuthorized(req, r));
        res.json(authorized_docs);
    };

    async bulk_delete(req: Request, res: Response): Promise<void> {
        const ids = (req.query.ids as string).split(",");

        await this._repo.removeMany(ids);

        res.json({OK: ids});
    };
}
