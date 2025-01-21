import {Repository} from "@meshql/common"
import {RepositoryCertification} from "./certification/repository.cert"
import {InMemory} from "./memory_repo";

const createRepository = async () : Promise<Repository> => {
    return new InMemory()
}

RepositoryCertification(createRepository, async () => {});

