import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from 'chai';
import { callSubgraph } from '@meshobj/graphlette';

export interface FarmTestWorld {
    app?: any;
    server?: any;
    config?: any;
    token?: string;
    farm_id?: string;
    coop1_id?: string;
    coop2_id?: string;
    hen_ids?: Record<string, string>;
    first_stamp?: number;
    queryResult?: any;
}

Given('a MeshQL server is running with the plugin', async function(this: FarmTestWorld) {
    // Server setup is done in BeforeAll hook in each repo
    expect(this.app).to.exist;
    expect(this.server).to.exist;
    expect(this.config).to.exist;
});

Given('the farm data has been populated', async function(this: FarmTestWorld) {
    // Data population is done in BeforeAll hook
    expect(this.farm_id).to.exist;
    expect(this.coop1_id).to.exist;
    expect(this.hen_ids).to.exist;
});

Given('I have captured the first timestamp', function(this: FarmTestWorld) {
    expect(this.first_stamp).to.be.greaterThan(0);
});

When('I query the farm graph:', async function(this: FarmTestWorld, docString: string) {
    const query = docString
        .replace(/\$\{farm_id\}/g, this.farm_id!)
        .replace(/\$\{coop1_id\}/g, this.coop1_id!);

    this.queryResult = await callSubgraph(
        new URL(`http://localhost:${this.config!.port}/farm/graph`),
        query,
        'getById',
        `Bearer ${this.token}`
    );
});

When('I query the farm graph at the first timestamp:', async function(this: FarmTestWorld, docString: string) {
    const query = docString
        .replace(/\$\{farm_id\}/g, this.farm_id!)
        .replace(/\$\{first_stamp\}/g, String(this.first_stamp!));

    this.queryResult = await callSubgraph(
        new URL(`http://localhost:${this.config!.port}/farm/graph`),
        query,
        'getById',
        `Bearer ${this.token}`
    );
});

When('I query the farm graph at the current timestamp:', async function(this: FarmTestWorld, docString: string) {
    const now = Date.now();
    const query = docString
        .replace(/\$\{farm_id\}/g, this.farm_id!)
        .replace(/\$\{now\}/g, String(now));

    this.queryResult = await callSubgraph(
        new URL(`http://localhost:${this.config!.port}/farm/graph`),
        query,
        'getById',
        `Bearer ${this.token}`
    );
});

When('I query the hen graph:', async function(this: FarmTestWorld, docString: string) {
    const query = docString
        .replace(/\$\{coop1_id\}/g, this.coop1_id!);

    const queryName = query.includes('getByName') ? 'getByName' :
                      query.includes('getByCoop') ? 'getByCoop' : 'getById';

    this.queryResult = await callSubgraph(
        new URL(`http://localhost:${this.config!.port}/hen/graph`),
        query,
        queryName,
        `Bearer ${this.token}`
    );
});

When('I query the coop graph:', async function(this: FarmTestWorld, docString: string) {
    const query = docString
        .replace(/\$\{coop1_id\}/g, this.coop1_id!);

    this.queryResult = await callSubgraph(
        new URL(`http://localhost:${this.config!.port}/coop/graph`),
        query,
        'getById',
        `Bearer ${this.token}`
    );
});

When('I query the coop graph at the first timestamp:', async function(this: FarmTestWorld, docString: string) {
    const query = docString
        .replace(/\$\{coop1_id\}/g, this.coop1_id!)
        .replace(/\$\{first_stamp\}/g, String(this.first_stamp!));

    this.queryResult = await callSubgraph(
        new URL(`http://localhost:${this.config!.port}/coop/graph`),
        query,
        'getById',
        `Bearer ${this.token}`
    );
});

Then('the farm name should be {string}', function(this: FarmTestWorld, expectedName: string) {
    expect(this.queryResult.name).to.equal(expectedName);
});

Then('there should be {int} coops', function(this: FarmTestWorld, expectedCount: number) {
    expect(this.queryResult.coops).to.have.length(expectedCount);
});

Then('the result should contain a hen with name {string}', function(this: FarmTestWorld, name: string) {
    expect(this.queryResult).to.be.an('array');
    expect(this.queryResult[0].name).to.equal(name);
});

Then('the hen ID should match the saved duck ID', function(this: FarmTestWorld) {
    expect(this.queryResult[0].id).to.equal(this.hen_ids!['duck']);
});

Then('there should be {int} hens', function(this: FarmTestWorld, expectedCount: number) {
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

Then('the coop ID should match coop1', function(this: FarmTestWorld) {
    expect(this.queryResult.id).to.equal(this.coop1_id);
});

Then('the coops should not include {string}', function(this: FarmTestWorld, name: string) {
    const names = this.queryResult.coops.map((c: any) => c.name);
    expect(names).to.not.include(name);
});

Then('the coops should include {string}', function(this: FarmTestWorld, name: string) {
    const names = this.queryResult.coops.map((c: any) => c.name);
    expect(names).to.include(name);
});
