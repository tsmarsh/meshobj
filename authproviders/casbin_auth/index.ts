import {Enforcer, newEnforcer} from "casbin";
import {Auth} from "@meshql/auth";
import {JWTSubAuthorizer} from "@meshql/jwt_auth";
import {Envelope} from "@meshql/common";


class CasbinAuth implements Auth {

    enforcer: Enforcer;
    jwtAuth = new JWTSubAuthorizer();

    async constructor(...params: any[]) {
        this.enforcer = await newEnforcer(params);
    }

    async getAuthToken(context): Promise<any> {
        let sub = await this.jwtAuth.getAuthToken(context);
        return await this.enforcer.getRolesForUser(sub[0])
    }

    async isAuthorized(credentials: string[], data: Envelope<any>): Promise<boolean> {
        return (
            data.authorized_tokens?.length === 0 || //everyone can read
            data.authorized_tokens?.some((t) => credentials.includes(t))
        );
    }

}