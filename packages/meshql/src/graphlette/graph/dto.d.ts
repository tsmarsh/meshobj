import { Resolver } from '@meshql/common';
export declare class DTOFactory {
    resolvers: {
        [key: string]: any;
    };
    constructor(config?: Resolver[]);
    fillOne(data: Record<string, any>, timestamp: number): Record<string, any>;
    fillMany(data: Record<string, any>, timestamp: number): Record<string, any>[];
}
//# sourceMappingURL=dto.d.ts.map