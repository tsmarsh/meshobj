import { Repository, Searcher } from '@meshobj/common';
import { StorageConfig } from './configTypes';
import { DTOFactory } from '@meshobj/graphlette';
import { Auth } from '@meshobj/auth';

export interface Plugin {
    createRepository: (config: StorageConfig) => Promise<Repository>;
    createSearcher: (config: StorageConfig, dtoFactory: DTOFactory, auth: Auth) => Promise<Searcher>;
    cleanup: () => Promise<void>;
}
