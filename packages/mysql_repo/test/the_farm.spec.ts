import { GenericContainer, StartedTestContainer } from "testcontainers";
import Log4js from "log4js";
import { ServerCertificiation } from "../../meshql/test/the_farm.cert";
import { describe } from "vitest";

let container: StartedTestContainer | null = null;

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
    container = await new GenericContainer("mysql:8.0")
      .withExposedPorts(3306)
      .withEnvironment({
        MYSQL_ROOT_PASSWORD: "root",
        MYSQL_DATABASE: "test"
      })
      .start();

    const host = container.getHost();
    const port = container.getMappedPort(3306);

    // Set MySQL-specific environment variables
    process.env.MYSQL_HOST = host;
    process.env.MYSQL_PORT = port.toString();
    process.env.MYSQL_DB = "test";
    process.env.MYSQL_USER = "root";
    process.env.MYSQL_PASSWORD = "root";

    // Other environment variables
    process.env.ENV = "test";
    process.env.PREFIX = "farm";
    process.env.PLATFORM_URL = "http://localhost:3033";

  } catch (err) {
    console.error(JSON.stringify(err));
  }
};

const cleanup = async () => {
  if (container) {
    await container.stop({ timeout: 10000 });
  }
};

const configPath = `${__dirname}/config/config.conf`;

describe.skip("The Farm", () => {
    ServerCertificiation(setup, cleanup, configPath);
});
