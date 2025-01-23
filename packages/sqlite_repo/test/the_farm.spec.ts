import { ServerCertificiation } from "../../meshql/test/the_farm.cert";
import Log4js from "log4js";
import { describe, it, expect } from "vitest";

Log4js.configure({
    appenders: {
        out: {
            type: "stdout",
        },
    },
    categories: {
        default: { appenders: ["out"], level: "trace" },
    },
});

let setup = async () => {
    // Set environment variables for sqlite_repo/test/config/config.conf
    process.env.ENV = "test";
    process.env.PREFIX = "farm";
    process.env.PLATFORM_URL = "http://localhost:3033";
};

let cleanup = async () => {
    // If you create or reference a shared in-memory DB, you could close it here.
    // For SQLite in-memory mode, there is no usual server process to stop.
};

let configPath = `${__dirname}/config/config.conf`;

// Pass in the updated setup, cleanup, and configPath
describe.skip("The Farm", () => {
    ServerCertificiation(setup, cleanup, configPath);
});
