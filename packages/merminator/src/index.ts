#!/usr/bin/env node

import { program } from 'commander';
import { merminate } from './processor.js'; // Ensure processor.packages compiles to processor.js
import Log4js from 'log4js';

// Define an interface for CLI options
interface CliOptions {
    file: string;
    dest: string;
    url: string;
}

// Logger Setup
const logger = Log4js.getLogger('gridql/merminator');
logger.level = process.env.LOG_LEVEL || 'info'; // Allow dynamic log level

// Define CLI program
program
    .name('Merminator')
    .description('Takes a Mermaid class diagram and parses it into configuration for a GridQL cluster')
    .addHelpText(
        'after',
        `
Example call:
  $ merminator --file example.mmd --dest config --url http://localhost:3033`,
    )
    .requiredOption('-f, --file <file>', 'Mermaid file to convert.')
    .option('-d, --dest <dest>', 'Destination path for the output. Defaults to the current directory.', '.')
    .option(
        '-u, --url <url>',
        "Internal host URL. Defaults to 'http://localhost:3033'.",
        (value: string): string => {
            try {
                return new URL(value).toString(); // Ensures valid URL format
            } catch {
                throw new Error('Invalid URL format');
            }
        },
        'http://localhost:3033',
    )
    .action((options: CliOptions) => {
        logger.info(`Processing file: ${options.file}`);
        logger.info(`Destination: ${options.dest}`);
        logger.info(`URL: ${options.url}`);

        // Call the processing function
        merminate(options.file, options.dest, options.url);
    });

// Parse CLI arguments
program.parse();
