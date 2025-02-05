import { ServerCertificiation } from '../../meshql/test/the_farm.cert';
import Log4js from 'log4js';
import { describe, it, expect } from 'vitest';

Log4js.configure({
    appenders: {
        out: {
            type: 'stdout',
        },
    },
    categories: {
        default: { appenders: ['out'], level: 'error' },
    },
});

let serverPort: string = '5255';

let setup = async () => {
    // Set environment variables for sqlite_repo/test/config/config.conf
    process.env.ENV = 'test';
    process.env.PORT = serverPort;
    process.env.PREFIX = 'farm';
    process.env.PLATFORM_URL = `http://localhost:${serverPort}`;
};

let cleanup = async () => {
    const fs = require('fs');
    try {
        fs.unlinkSync('./thefarm.db');
    } catch (err) {
        // Ignore errors if file doesn't exist
    }
};

let configPath = `${__dirname}/config/config.conf`;

// Pass in the updated setup, cleanup, and configPath
describe('The Farm', () => {
    ServerCertificiation(setup, cleanup, configPath);
});
