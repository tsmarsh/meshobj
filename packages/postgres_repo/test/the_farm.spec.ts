import { GenericContainer, StartedTestContainer } from "testcontainers";
import { Pool } from "pg";
import Log4js from "log4js";
import { ServerCertificiation } from "../../meshql/test/the_farm.cert";

let container: StartedTestContainer | null = null;
let pool: Pool | null = null;

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

const setup = async () => {
  try {
    container = await new GenericContainer("postgres")
      .withExposedPorts(5432)
      .withEnvironment({
        POSTGRES_PASSWORD: "password",
        POSTGRES_DB: "test",
      })
      .start();

    const host = container.getHost();
    const port = container.getMappedPort(5432);

    // Set (or overwrite) any environment variables needed by your application.
    process.env.POSTGRES_HOST = host;
    process.env.POSTGRES_PORT = port.toString();
    process.env.POSTGRES_DB = "test";
    process.env.POSTGRES_USER = "postgres";
    process.env.POSTGRES_PASSWORD = "password";

    // Other environment variables you might need for your application
    process.env.ENV = "test";
    process.env.PREFIX = "farm";
    process.env.PLATFORM_URL = "http://localhost:3033";

    pool = new Pool({
      user: "postgres",
      host,
      database: "test",
      password: "password",
      port,
    });
  } catch (err) {
    console.error(JSON.stringify(err));
  }
};

const cleanup = async () => {
  if (pool) {
    await pool.end();
  }
  if (container) {
    await container.stop();
  }
};

const configPath = `${__dirname}/config/config.conf`;

// Run the shared server-level certification tests
//ServerCertificiation(setup, cleanup, configPath);