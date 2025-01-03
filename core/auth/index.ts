export interface Auth {
    getAuthToken(context: any): Promise<any>;
    isAuthorized(creds: any, data: Record<string, any>): Promise<boolean>;
}

export class NoOp implements Auth {
    secureData(creds: any, data: any): any {
        return data;
    }

    secureRead(creds: any, query: any): any {
        return query;
    }

    async getAuthToken(context: any): Promise<any> {
        return "TOKEN";
    }

    async isAuthorized(creds: any, data: Record<string, any>): Promise<boolean> {
        return true;
    }
}

export type ReadSecurer<T> = (creds: any, query: any) => Promise<T>
