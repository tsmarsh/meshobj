import { Repository } from "@meshql/common";
import { RepositoryCertification } from "../../common/test/certification/repository.cert";
import { MySQLRepository } from "../src/mysqlRepo";
import { createPool, Pool } from "mysql2/promise";
import { GenericContainer, StartedTestContainer } from "testcontainers";
import { randomUUID } from "crypto";

let container: StartedTestContainer;
const pools: Pool[] = [];

const createRepository = async (): Promise<Repository> => {
    if (!container) {
        container = await new GenericContainer("mysql:8.0")
            .withEnvironment({
                MYSQL_ROOT_PASSWORD: "root",
                MYSQL_DATABASE: "test"
            })
            .withExposedPorts(3306)
            .start();
    }

    const pool = createPool({
        host: container.getHost(),
        port: container.getMappedPort(3306),
        user: "root",
        password: "root",
        database: "test",
        waitForConnections: true,
        connectionLimit: 10,
        maxIdle: 10,
        idleTimeout: 60000,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0
    });

    pools.push(pool);
    const repo = new MySQLRepository(pool, `test_${randomUUID().replace(/-/g, '')}`);
    await repo.initialize();
    return repo;
};

const tearDown = async (): Promise<void> => {
    await Promise.all(pools.map(pool => pool.end()));
    if (container) {
        await container.stop();
    }
};

RepositoryCertification(createRepository, tearDown); 