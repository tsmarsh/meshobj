export interface Repo {
    create: (payload: any) => Promise<Record<string, any>>;
    read: (id: string, authFn: (data: any) => Promise<boolean>, options?: any) => Promise<Record<string, any>>;
    list: (queryFn: (query: any) => any) => Promise<Record<string, any>[]>;
    remove: (id: string) => Promise<boolean>;
    createMany: (payloads: any[]) => Promise<{ OK: string[] }>;
    readMany: (ids: string[], authFn: (data: any) => any) => Promise<any[]>;
    removeMany: (ids: string[]) => Promise<void>;
}