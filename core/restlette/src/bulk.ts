import {Auth} from "@meshql/auth";
import {Request, Response} from "express";

import {Repo} from "./repo";

export const bulk_create = (repo: Repo, context: string, authorizer: Auth) => async (req: Request, res: Response) => {
    const docs = req.body;

    const secured_docs = docs.map((payload: any) => authorizer.secureData(req, {payload}));
    const created = await repo.createMany(secured_docs);

    created.OK = created.OK.map((id) => `${context}/${id}`);
    res.json(created);
};

export const bulk_read = (repo: Repo, authorizer: Auth) => async (req: Request, res: Response) => {
    const ids = (req.query.ids as string).split(",");

    const found = await repo.readMany(ids, (data) => authorizer.secureData(req, data));

    const authorized_docs = found.filter((r) => authorizer.isAuthorized(req, r));
    res.json(authorized_docs);
};

export const bulk_delete = (repo: Repo) => async (req: Request, res: Response) => {
    const ids = (req.query.ids as string).split(",");

    await repo.removeMany(ids);

    res.json({OK: ids});
};