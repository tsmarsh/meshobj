import { Request, Response } from 'express';

export const authorizeResponse = (req: Request, res: Response): Response => {
    if (req.headers.authorization !== undefined) {
        res.header('Authorization', req.headers.authorization);
    }

    return res;
};
