export interface Repo {
    find(queryTemplate: Handlebars.Template, args: any, auth_token: any, timestamp?: number): Promise<Record<string, any>>;
    findAll(queryTemplate: Handlebars.Template, args: any, auth_token: any, timestamp?: number): Promise<Record<string, any>[]>;
}