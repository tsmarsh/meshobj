#!/usr/bin/env node

import yargs from 'yargs';
import { init } from "./server";
import { Config } from "./configTypes";
const parser = require("@pushcorn/hocon-parser");

export default async function startServer(configPath?: string) {
    const argv = yargs(process.argv.slice(2))
        .option('config', {
            type: 'string',
            description: 'Path to the config file',
            default: configPath || "config/config.conf",
        })
        .option('port', {
            type: 'number',
            description: 'Override port from config file'
        })
        .help()
        .argv;

    const configFile = argv.config as string;
    console.log(`Using config file: ${configFile}`);
    
    try {
        const config: Config = await parser.parse({ url: configFile });
        if (argv.port) {
            config.port = argv.port;
        }

        const app = await init(config);
        await app.listen(config.port);
        console.log(`Server running on port ${config.port}`);
        
        return app;
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

// Auto-execute if called directly from CLI
if (require.main === module) {
    startServer().catch(console.error);
}