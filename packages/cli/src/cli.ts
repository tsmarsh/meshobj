#!/usr/bin/env node

import yargs from 'yargs';
import { init, Config } from '@meshobj/server';
import { SQLitePlugin } from '@meshobj/sqlite_repo';
import { MongoPlugin } from '@meshobj/mongo_repo';
import { MySQLPlugin } from '@meshobj/mysql_repo';
import { PostgresPlugin } from '@meshobj/postgres_repo';
const parser = require('@pushcorn/hocon-parser');
import { configureLogging, getLogger } from '@meshobj/common';

// Configure logging
configureLogging('debug');
const log = getLogger('meshobj/cli');

export default async function startServer(configPath?: string) {
    const argv = await yargs(process.argv.slice(2))
        .option('config', {
            type: 'string',
            description: 'Path to the config file',
            default: configPath || 'config/config.conf',
        })
        .option('port', {
            type: 'number',
            description: 'Override port from config file',
        })
        .help()
        .parseAsync();

    const configFile = argv.config;
    log.info(`Using config file: ${configFile}`);

    try {
        const config: Config = await parser.parse({ url: configFile });
        log.debug(`Config: ${JSON.stringify(config)}`);
        if (argv.port) {
            config.port = argv.port;
        }

        const app = await init(config, {
            sql: new SQLitePlugin(),
            mongo: new MongoPlugin(),
            mysql: new MySQLPlugin(),
            postgres: new PostgresPlugin(),
        });

        await app.listen(config.port);
        log.info(`Server running on port ${config.port}`);

        return app;
    } catch (err) {
        log.error('Failed to start server:', err);
        process.exit(1);
    }
}

// Auto-execute if called directly from CLI
if (require.main === module) {
    startServer().catch((error) => log.error('Server startup failed:', error));
}
