import { DeploymentStorageConfig } from './types.js';

export class Database {
    constructor(
        public readonly type: 'mongo' | 'postgres' | 'mysql' | 'sqlite',
        public readonly uri: string,
        public readonly db?: string,
        public readonly options?: Record<string, any>
    ) {}

    /**
     * Create a collection-specific config for this database
     */
    forCollection(collection: string): DeploymentStorageConfig {
        return {
            type: this.type,
            uri: this.uri,
            db: this.db,
            collection,
            options: this.options
        };
    }

    /**
     * Get the config for this database
     */
    getConfig(): Omit<DeploymentStorageConfig, 'collection'> {
        return {
            type: this.type,
            uri: this.uri,
            db: this.db,
            options: this.options
        };
    }

    /**
     * Create environment variable references for use in docker-compose
     */
    getEnvUri(envVar: string = 'MONGO_URI'): string {
        return `\${?${envVar}}`;
    }

    static MongoDB(uri: string, db: string, options?: Record<string, any>): Database {
        return new Database('mongo', uri, db, options || { directConnection: true });
    }

    static PostgreSQL(uri: string, db: string, options?: Record<string, any>): Database {
        return new Database('postgres', uri, db, options);
    }

    static MySQL(uri: string, db: string, options?: Record<string, any>): Database {
        return new Database('mysql', uri, db, options);
    }

    static SQLite(uri: string, options?: Record<string, any>): Database {
        return new Database('sqlite', uri, undefined, options);
    }
}
