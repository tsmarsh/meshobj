export interface Auth {
    getAuthToken(context: any): Promise<any>;
    isAuthorized(creds: any, data: Record<string, any>): Promise<boolean>;
}