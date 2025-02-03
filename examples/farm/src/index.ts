import { init } from "@meshql/meshql";
const parser = require("@pushcorn/hocon-parser");
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

async function main() {
    // Get config path from environment variable or use default
    const configFile = process.env.MESHQL_CONFIG_PATH || path.join(__dirname, '../config/config.conf');
    console.log(`Using config file: ${configFile}`);

    const config = await parser.parse({ url: configFile });
    const app = await init(config);

    const port = process.env.PORT || 3033;
    await app.listen({ port: Number(port) });

    console.log(`Server running on port ${port}`);
    console.log(`GraphQL playground: http://localhost:${port}/graphql`);
    console.log(`API documentation: http://localhost:${port}/docs`);
}

main().catch(console.error);