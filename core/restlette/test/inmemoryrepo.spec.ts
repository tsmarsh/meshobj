import {numvelop, Repository, RepositoryCertification} from "@meshql/common"
import {InMemory} from "../src/repo";

const createRepository: () => Repository<number> = () :Repository<number> => {
    return new InMemory()
}

RepositoryCertification(createRepository, numvelop);

