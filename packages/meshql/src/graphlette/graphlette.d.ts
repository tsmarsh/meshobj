export { DTOFactory } from './graph/dto.js';
export { context, root } from './graph/root.js';
export { callSubgraph } from './graph/subgraph.js';
import { Application } from 'express';
export declare function init(app: Application, schema: string, path: string, rootValue: Record<string, any>): Application;
//# sourceMappingURL=graphlette.d.ts.map