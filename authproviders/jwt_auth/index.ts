import {Auth} from "@meshql/auth";
import {getLogger} from "log4js";
import jwt from "jsonwebtoken";

let logger = getLogger("meshql/jwtauth");

class JWTSubAuthorizer implements Auth {
    async getAuthToken(context: any): Promise<any> {
        const authHeader = context.headers?.authorization;

        if (authHeader === null || authHeader === undefined) {
            return null;
        }

        if (authHeader.startsWith("Bearer ")) {
            const token = authHeader.substring(7, authHeader.length);

            const dToken = jwt.decode(token);

            return dToken["sub"];
        } else {
            logger.error("Missing Bearer Token");
            return null;
        }
    }

    async isAuthorized(creds: any, data: Record<string, any>): Promise<boolean> {
        if (data === undefined) throw new Error("Nothing to Authorize");
        return (
            creds === undefined || //internal or a test (hasn't gone through gateway)
            creds === null ||
            data.authorized_readers.length === 0 || //everyone can read
            data.authorized_readers.includes(creds)
        );
    }

}