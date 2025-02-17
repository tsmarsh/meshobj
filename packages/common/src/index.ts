import { TemplateDelegate } from 'handlebars';
import { z } from 'zod';

// Convert common types to Zod schemas
export const SingletonSchema = z.object({
    query: z.string(),
    name: z.string(),
    id: z.string().optional()
});

export type Singleton = z.infer<typeof SingletonSchema>;

export const VectorSchema = z.object({
    query: z.string(),
    name: z.string(),
    id: z.string().optional()
});

export type Vector = z.infer<typeof VectorSchema>;

export const ResolverSchema = z.object({
    name: z.string(),
    id: z.string().optional(),
    queryName: z.string(),
    url: z.string().url()
});

export type Resolver = z.infer<typeof ResolverSchema>;

export const RootConfigSchema = z.object({
    singletons: z.array(SingletonSchema).optional(),
    vectors: z.array(VectorSchema).optional(),
    resolvers: z.array(ResolverSchema).optional()
});

export type RootConfig = z.infer<typeof RootConfigSchema>;

export const IdSchema = z.string();
export type Id = z.infer<typeof IdSchema>;

export const PayloadSchema = z.record(z.any());
export type Payload = z.infer<typeof PayloadSchema>;

export const EnvelopeSchema = z.object({
    id: IdSchema.optional(),
    payload: PayloadSchema,
    created_at: z.date().optional(),
    deleted: z.boolean().optional(),
    authorized_tokens: z.array(z.string()).optional()
});

export type Envelope = z.infer<typeof EnvelopeSchema>;

export interface Repository {
    create: (envelope: Envelope, tokens?: string[]) => Promise<Envelope>;
    read: (id: Id, tokens?: string[], createdAt?: Date) => Promise<Envelope | undefined>;
    list: (tokens?: string[]) => Promise<Envelope[]>;
    remove: (id: Id, tokens?: string[]) => Promise<boolean>;
    createMany: (payloads: Envelope[], tokens?: string[]) => Promise<Envelope[]>;
    readMany: (ids: Id[], tokens?: string[]) => Promise<Envelope[]>;
    removeMany: (ids: Id[], tokens?: string[]) => Promise<Record<Id, boolean>>;
}

export interface Searcher {
    find(
        queryTemplate: TemplateDelegate,
        args: Record<string, any>,
        creds?: string[],
        timestamp?: number,
    ): Promise<Record<string, any>>;
    findAll(
        queryTemplate: TemplateDelegate,
        args: Record<string, any>,
        creds?: string[],
        timestamp?: number,
    ): Promise<Record<string, any>[]>;
}

export interface Validator {
    (data: Record<string, any>): Promise<boolean>;
}
