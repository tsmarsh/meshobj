import {numvelop, Repository, RepositoryCertification} from "@meshql/common"
import {InMemory} from "../src";

const createRepository = async () : Promise<Repository<number>> => {
    return new InMemory()
}

RepositoryCertification(createRepository, async () => {}, numvelop);

