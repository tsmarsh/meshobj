import { Given, When, Then, DataTable } from '@cucumber/cucumber';
import { expect } from 'chai';
import { callSubgraph } from '@meshobj/graphlette';
import { Document, OpenAPIClient, OpenAPIClientAxios } from 'openapi-client-axios';
import Handlebars from 'handlebars';
import { FarmTestWorld } from '../support/worlds';

Given('a MeshQL server is running with the plugin', async function(this: FarmTestWorld) {
    const swagger_docs = await getSwaggerDocs(this.config);

    const authHeaders = { Authorization: `Bearer ${this.token}` };

    const apis: OpenAPIClient[] = await Promise.all(
        swagger_docs.map(async (doc: Document) => {
            const api = new OpenAPIClientAxios({
                definition: doc,
                axiosConfigDefaults: { headers: authHeaders },
            });
            return api.init();
        }),
    );

    for (const api of apis) {
        const firstPath = Object.keys(api.paths)[0];
        if (firstPath.includes('hen')) this.apis["hen"] = api;
        else if (firstPath.includes('coop')) this.apis["coop"] = api;
        else if (firstPath.includes('farm')) this.apis["farm"] = api;
    }

    expect(this.app).to.exist;
    expect(this.server).to.exist;
    expect(this.config).to.exist;
});

Given('I have captured the first timestamp', function(this: FarmTestWorld) {

    expect(this.first_stamp).to.be.greaterThan(0);
});

When('I query the {string} graph:', async function(this: FarmTestWorld, graphName: string, docString: string) {
    const queryTemplate = Handlebars.compile(docString);
    this["now"] = String(Date.now());

    const query = queryTemplate(this);
    const queryName= docString.match(/(get\w*)/)![1];

    this.queryResult = await callSubgraph(
        new URL(`http://localhost:${this.config!.port}/${graphName}/graph`),
        query,
        queryName,
        `Bearer ${this.token}`
    );
});

Then('the farm name should be {string}', function(this: FarmTestWorld, expectedName: string) {
    expect(this.queryResult.name).to.equal(expectedName);
});

Then('there should be {int} {string}', function(this: FarmTestWorld, expectedCount: number, thing: string) {
    expect(this.queryResult[thing]).to.have.length(expectedCount);
});

Then('the result should contain {string} {string}', function(this: FarmTestWorld, key: string, value: string) {
    expect(this.queryResult).to.be.an('array');
    expect(this.queryResult[0][key]).to.equal(value);
});

Then('the {string} ID should match the saved {string} ID', function(this: any, thing: string, henName: string) {
    expect(this.queryResult.id).to.equal(this[`${thing}_ids`][henName]);
});

Then('the {int} {string} ID should match the saved {string} ID', function(this: any, index: number , thing: string, henName: string) {
    expect(this.queryResult[index].id).to.equal(this[`${thing}_ids`][henName]);
});

Then('there should be {int} results', function(this: FarmTestWorld, expectedCount: number) {
    expect(this.queryResult).to.have.length(expectedCount);
});

Then('the hens should include {string} and {string}', function(this: FarmTestWorld, name1: string, name2: string) {
    const names = this.queryResult.map((hen: any) => hen.name);
    expect(names).to.include(name1);
    expect(names).to.include(name2);
});

Then('the coop name should be {string}', function(this: FarmTestWorld, expectedName: string) {
    if (Array.isArray(this.queryResult)) {
        expect(this.queryResult[0].coop.name).to.equal(expectedName);
    } else {
        expect(this.queryResult.name).to.equal(expectedName);
    }
});

Then('the results should not include {string}', function(this: FarmTestWorld, name: string) {
    const names = this.queryResult.coops.map((c: any) => c.name);
    expect(names).to.not.include(name);
});

Then('the results should include {string}', function(this: FarmTestWorld, name: string) {
    const names = this.queryResult.coops.map((c: any) => c.name);
    expect(names).to.include(name);
});

Given("I have created {string}:", function(this: FarmTestWorld, thing: string, dataTable: DataTable) {
    let api = this.apis[thing];
    dataTable.hashes().map((newThing) => {
        const template = Handlebars.compile(newThing.data);
        const result = api.create(null, template(this));
        this.ids[thing][newThing.name] = result.request.path.slice(-36);
    })
});

Given("I have updated {string}:", function(this: FarmTestWorld, thing: string, dataTable: DataTable) {
    let api = this.apis[thing];
    dataTable.hashes().map((updateThing) => {
        const template = Handlebars.compile(updateThing.data);
        api.update({ id: this.ids[thing][updateThing.name] }, template(this));
    })
});

Given('I take a timestamp', async function(this: FarmTestWorld) {
    this.first_stamp = Date.now();
})

async function getSwaggerDocs(config: any): Promise<Document[]> {
    return await Promise.all(
        config.restlettes.map(async (restlette: any) => {
            const url = `http://localhost:${config.port}${restlette.path}/api-docs/swagger.json`;
            const response = await fetch(url);
            return await response.json();
        }),
    );
}
