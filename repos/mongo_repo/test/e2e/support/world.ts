import {FarmTestWorld} from "core/common/test/support/worlds";
import { setWorldConstructor } from '@cucumber/cucumber';
import { MongoMemoryServer } from 'mongodb-memory-server';

class MongoE2EWorld implements FarmTestWorld
    constructor() {
        if (!mongod) {
            mongod = await MongoMemoryServer.create();
        }
    }
}

setWorldConstructor(MongoE2EWorld);