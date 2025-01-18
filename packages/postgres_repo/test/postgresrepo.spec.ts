import { Pool } from "pg";
import { PostgresRepository } from "../src/postgresRepo"; // Assuming the repository is in this file
import { GenericContainer, StartedTestContainer } from "testcontainers";
import {RepositoryCertification} from "../../common/test/certification/repository.cert";
import {strinvelop} from "@meshql/common";
import {Environment} from "testcontainers/build/types";

let container: StartedTestContainer | null = null;
let dbs: Pool[] = []; // To track active connections

const createRepository = async (): Promise<PostgresRepository> => {
    // Start a PostgreSQL container using TestContainers
    let env: Environment = {
        "POSTGRES_PASSWORD": "password",
        "POSTGRES_DB": "test"
    }
    if (!container) {
        container = await new GenericContainer("postgres")
            .withExposedPorts(5432)
            .withEnvironment(env)
            .start();
    }

    const host = container.getHost();
    const port = container.getMappedPort(5432);

    // Connect to the database
    const pool = new Pool({
        user: "postgres",
        host,
        database: "test",
        password: "password",
        port,
    });

    dbs.push(pool);

    // Create the repository
    const repo = new PostgresRepository(pool, `test${dbs.length}`);

    await repo.initialize();

    return repo;
};

const tearDown = async (): Promise<void> => {

    await Promise.all(dbs.map((db) => {db.end()}));
    if(container){
        await container.stop()
    }
}

RepositoryCertification(createRepository, tearDown, strinvelop);