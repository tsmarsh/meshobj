import { DTOFactory } from './dto.js';
import { Searcher, RootConfig } from '@meshql/common';
import { Auth } from '@meshql/auth';
export declare function context(repo: Searcher, authorizer: Auth, config: RootConfig): {
    dtoFactory: DTOFactory;
    root: Record<string, any>;
};
export declare function root(repo: Searcher, dtoFactory: DTOFactory, authorizer: Auth, { singletons, vectors }: RootConfig): Record<string, any>;
//# sourceMappingURL=root.d.ts.map