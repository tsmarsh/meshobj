const {numvelop, Repository, RepositoryCertification} = require("@meshql/common")
import {InMemory} from "../src";

const createRepository = async () : Promise<Repository<number>> => {
    return new InMemory()
}

RepositoryCertification(createRepository, async () => {}, numvelop);

