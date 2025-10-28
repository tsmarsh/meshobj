import { Given, When, Then, DataTable } from '@cucumber/cucumber';
import { TestWorld } from '../support/world';
import { expect } from 'vitest';
import { Envelope } from '../../src';

Given('a fresh repository and searcher instance', async function(this: TestWorld) {
    if (!this.createSearcher) {
        throw new Error('createSearcher function not provided to test');
    }
    const { repository, searcher } = await this.createSearcher();
    this.repository = repository;
    this.searcher = searcher;
});

Given('I have created and saved the following test dataset:', async function(this: TestWorld, dataTable: DataTable) {
    const rows = dataTable.hashes();
    const envelopes = rows.map(row => ({ payload: row }));
    const saved = await this.repository!.createMany(envelopes, this.tokens);

    saved.forEach(envelope => {
        this.envelopes.set(envelope.payload.name, envelope);
    });
});

Given('I have removed envelope {string}', async function(this: TestWorld, name: string) {
    const envelope = this.envelopes.get(name);
    if (!envelope?.id) throw new Error(`Envelope "${name}" not found`);
    await this.repository!.remove(envelope.id, this.tokens);
});

Given('I have updated envelope {string} to {string} with count {int}', async function(this: TestWorld, oldName: string, newName: string, count: number) {
    const envelope = this.envelopes.get(oldName);
    if (!envelope) throw new Error(`Envelope "${oldName}" not found`);

    const updated = await this.repository!.create({
        id: envelope.id,
        authorized_tokens: envelope.authorized_tokens,
        payload: { ...envelope.payload, name: newName, count }
    });

    this.envelopes.delete(oldName);
    this.envelopes.set(newName, updated);
});

When('I search using template {string} with parameters:', async function(this: TestWorld, templateName: string, dataTable: DataTable) {
    const rows = dataTable.hashes();
    const params = rows[0];

    if (!this.templates?.[templateName]) {
        throw new Error(`Template "${templateName}" not found`);
    }

    this.searchResult = await this.searcher!.find(this.templates[templateName], params);
});

When('I search all using template {string} with parameters:', async function(this: TestWorld, templateName: string, dataTable: DataTable) {
    const rows = dataTable.hashes();
    const params = rows[0];

    if (!this.templates?.[templateName]) {
        throw new Error(`Template "${templateName}" not found`);
    }

    this.searchResults = await this.searcher!.findAll(this.templates[templateName], params);
});

Then('the search result should be empty', function(this: TestWorld) {
    expect(this.searchResult).toEqual({});
});

Then('the search result should have name {string}', function(this: TestWorld, expectedName: string) {
    expect(this.searchResult.name).toBe(expectedName);
});

Then('the search result should have count {int}', function(this: TestWorld, expectedCount: number) {
    expect(this.searchResult.count).toBe(expectedCount);
});

Then('I should receive exactly {int} result(s)', function(this: TestWorld, count: number) {
    expect(this.searchResults?.length).toBe(count);
});

Then('the results should include an envelope with name {string} and count {int}', function(this: TestWorld, name: string, count: number) {
    const found = this.searchResults?.find(r => r.name === name && r.count === count);
    expect(found).toBeDefined();
});

Then('the results should include an envelope with name {string}', function(this: TestWorld, name: string) {
    const found = this.searchResults?.find(r => r.name === name);
    expect(found).toBeDefined();
});
