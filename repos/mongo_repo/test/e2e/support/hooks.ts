import { Before, After, AfterAll, BeforeAll, setDefaultTimeout } from '@cucumber/cucumber';
import { IntegrationWorld } from '';
import { FarmTestWorld } from 'core/common/test/steps/farm_steps';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { compile } from 'handlebars';
import { init, Plugin, StorageConfig } from '@meshobj/server';
import * as jwt from 'jsonwebtoken';
import { config as getFarmConfig } from '../../integration/config';
import Log4js from 'log4js';

Log4js.configure({
    appenders: { out: { type: 'stdout' } },
    categories: { default: { appenders: ['out'], level: 'error' } },
});

let mongod: MongoMemoryServer;

// Setup for farm tests
BeforeAll(async function() {

});

Before(async function(this: IntegrationWorld) {
    try {
        const app = await init(this.config, { mongo: this.plugin! });
        const server = await app.listen(this.config.port);
    } catch (e) {
        console.error('Failed to setup farm server:', e);
        throw e;
    }
    // Templates for searcher tests - MongoDB JSON query syntax
    this.templates = {
        findById: compile(`{"id": "{{id}}"}`),
        findByName: compile(`{"payload.name": "{{id}}"}`),
        findAllByType: compile(`{"payload.type": "{{id}}"}`),
        findByNameAndType: compile(`{"payload.name": "{{name}}", "payload.type": "{{type}}"}`),
    };

});

After(async function(this: IntegrationWorld) {
    this.plugin!.cleanup();
});

AfterAll(async function(){
    await mongod.stop();
} )