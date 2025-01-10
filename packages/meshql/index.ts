import {init} from "./src/server"
import parser from "@pushcorn/hocon-parser"
import {FastifyInstance} from "fastify";
import {Config} from "src/configTypes"
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const argv: any = yargs(hideBin(process.argv))
    .option('config', {
        type: 'string',
        description: 'Path to the config file ',
        default: "./config/config.conf",
        demandOption: false,
    })
    .parse();

console.log(`Using config file: ${argv.config}`);
let config: Config = parser.parse(argv.config);

let app: FastifyInstance = await init(config);

await app.listen({port: config.port});
