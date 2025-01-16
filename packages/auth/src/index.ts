import {Envelope} from "@meshql/common";

export interface Auth {
    getAuthToken(context: Record<string, any>): Promise<string[]>;
    isAuthorized(credentials: string[], data: Envelope<any>): Promise<boolean>;
}

export class NoOp implements Auth {
    async getAuthToken(context: Record<string, any>): Promise<string[]> {
        return ["TOKEN"];
    }

    async isAuthorized(creds: string[], data: Envelope<any>): Promise<boolean> {
        return true;
    }
}

export type ReadSecurer<T> = (creds: any, query: any) => Promise<T>
