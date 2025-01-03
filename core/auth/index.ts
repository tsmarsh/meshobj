export interface Auth {
    getAuthToken(context: any): Promise<any>;
    isAuthorized(creds: any, data: Record<string, any>): Promise<boolean>;
    secureData: (creds: any, data: any) => any;
    secureRead: (creds: any, query: any) => any;
}