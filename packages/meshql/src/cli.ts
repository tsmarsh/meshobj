#!/usr/bin/env node

import yargs from 'yargs';
import { init } from './server';
import { Config } from './configTypes';
const parser = require('@pushcorn/hocon-parser');
import Log4js from 'log4js';

Log4js.configure({
    appenders: {
        out: {
            type: 'stdout',
        },
    },
    categories: {
        default: { appenders: ['out'], level: 'debug' },
    },
});

const log = Log4js.getLogger();

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

        const app = await init(config);
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
    startServer().catch(console.error);
}
