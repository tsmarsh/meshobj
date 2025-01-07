import {Auth} from "@meshql/auth";
import {getLogger} from "log4js";
import jwt from "jsonwebtoken";
import {Envelope} from "@meshql/common";
import {Request} from "express";

let logger = getLogger("meshql/jwtauth");

export class JWTSubAuthorizer implements Auth {
    async getAuthToken(context: Request): Promise<string[]> {
        const authHeader = context.headers?.authorization;

        if (authHeader === null || authHeader === undefined) {
            return [];
        }

        if (authHeader.startsWith("Bearer ")) {
            const token = authHeader.substring(7, authHeader.length);

            const dToken = jwt.decode(token);

            return dToken["sub"];
        } else {
            logger.error("Missing Bearer Token");
            return [];
        }
    }

    async isAuthorized(credentials: string[], data: Envelope<any>): Promise<boolean> {
        return (
            data.authorized_tokens?.length === 0 || //everyone can read
            data.authorized_tokens?.some((t) => credentials.includes(t))
        );
    }
}