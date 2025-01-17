import {numvelop, Repository} from "@meshql/common"
import {RepositoryCertification} from "../../common/test/certification/repository.cert"
import {InMemory} from "../src";

const createRepository = async () : Promise<Repository<number>> => {
    return new InMemory()
}

RepositoryCertification(createRepository, async () => {}, numvelop);

