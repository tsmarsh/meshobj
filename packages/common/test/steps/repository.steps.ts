import { Given, When, Then, DataTable } from '@cucumber/cucumber';
import { TestWorld } from '../support/world';
import { expect } from 'vitest';

Given('a fresh repository instance', async function(this: TestWorld) {
    if (!this.createRepository) {
        throw new Error('createRepository function not provided to test');
    }
    this.repository = await this.createRepository();
});

Given('I have created envelopes:', async function(this: TestWorld, dataTable: DataTable) {
    const rows = dataTable.hashes();
    for (const row of rows) {
        const { name, ...payload } = row;
        const envelope = await this.repository!.create({ payload });
        this.envelopes.set(name, envelope);
    }
});

Given('I create envelopes:', async function(this: TestWorld, dataTable: DataTable) {
    const rows = dataTable.hashes();
    for (const row of rows) {
        const { name, ...payload } = row;
        const envelope = await this.repository!.create({ payload });
        this.envelopes.set(name, envelope);
    }
});

Given('I capture the current timestamp as {string}', function(this: TestWorld, label: string) {
    this.timestamps.set(label, Date.now());
});

Given('I wait {int} milliseconds', async function(this: TestWorld, ms: number) {
    await new Promise(resolve => setTimeout(resolve, ms));
});

When('I create envelopes:', async function(this: TestWorld, dataTable: DataTable) {
    const rows = dataTable.hashes();
    for (const row of rows) {
        const { name, ...payload } = row;
        const envelope = await this.repository!.create({ payload });
        this.envelopes.set(name, envelope);
    }
});

When('I create a new version of envelope {string}:', async function(this: TestWorld, name: string, dataTable: DataTable) {
    const existingEnvelope = this.envelopes.get(name);
    if (!existingEnvelope) {
        throw new Error(`Envelope "${name}" not found`);
    }

    const row = dataTable.hashes()[0];
    const payload = { ...row };

    const newVersion = await this.repository!.create({
        id: existingEnvelope.id,
        authorized_tokens: existingEnvelope.authorized_tokens,
        payload,
    });

    this.envelopes.set(name, newVersion);
});

When('I read envelopes {string} by their IDs', async function(this: TestWorld, namesJson: string) {
    const names = JSON.parse(namesJson);
    const ids = names.map((name: string) => {
        const envelope = this.envelopes.get(name);
        if (!envelope?.id) throw new Error(`Envelope "${name}" not found or has no ID`);
        return envelope.id;
    });

    if (ids.length === 1) {
        this.searchResult = await this.repository!.read(ids[0]);
        this.searchResults = this.searchResult ? [this.searchResult] : [];
    } else {
        this.searchResults = await this.repository!.readMany(ids);
    }
});

When('I remove envelopes {string} by their IDs', async function(this: TestWorld, namesJson: string) {
    const names = JSON.parse(namesJson);
    const ids = names.map((name: string) => {
        const envelope = this.envelopes.get(name);
        if (!envelope?.id) throw new Error(`Envelope "${name}" not found or has no ID`);
        return envelope.id;
    });

    if (ids.length === 1) {
        this.removeResult = await this.repository!.remove(ids[0]);
    } else {
        this.removeResult = await this.repository!.removeMany(ids);
    }
});

When('I list all envelopes', async function(this: TestWorld) {
    this.searchResults = await this.repository!.list();
});

Then('reading envelope {string} at timestamp {string} should return version {string}', async function(this: TestWorld, name: string, timestampLabel: string, expectedVersion: string) {
    const envelope = this.envelopes.get(name);
    if (!envelope?.id) throw new Error(`Envelope "${name}" not found`);

    const timestamp = this.timestamps.get(timestampLabel);
    if (!timestamp) throw new Error(`Timestamp "${timestampLabel}" not found`);

    const result = await this.repository!.read(envelope.id, [], new Date(timestamp));
    expect(result?.payload.version).toBe(expectedVersion);
});

Then('reading envelopes {string} by their IDs should return nothing', async function(this: TestWorld, namesJson: string) {
    const names = JSON.parse(namesJson);
    const ids = names.map((name: string) => {
        const envelope = this.envelopes.get(name);
        if (!envelope?.id) throw new Error(`Envelope "${name}" not found or has no ID`);
        return envelope.id;
    });

    if (ids.length === 1) {
        const result = await this.repository!.read(ids[0]);
        expect(result).toBeUndefined();
    } else {
        const results = await this.repository!.readMany(ids);
        expect(results).toEqual([]);
    }
});

Then('the envelopes should have generated IDs', function(this: TestWorld) {
    for (const envelope of this.envelopes.values()) {
        expect(envelope.id).toBeDefined();
        expect(typeof envelope.id).toBe('string');
    }
});

Then('the envelopes created_at should be greater than or equal to the test start time', function(this: TestWorld) {
    for (const envelope of this.envelopes.values()) {
        expect(envelope.created_at?.getTime()).toBeGreaterThanOrEqual(this.testStartTime);
    }
});

Then('the envelopes deleted flag should be false', function(this: TestWorld) {
    for (const envelope of this.envelopes.values()) {
        expect(envelope.deleted).toBeFalsy();
    }
});

Then('I should receive {int} envelope(s)', function(this: TestWorld, count: number) {
    expect(this.searchResults?.length).toBe(count);
});

Then('I should receive exactly {int} envelope(s)', function(this: TestWorld, count: number) {
    expect(this.searchResults?.length).toBe(count);
});

Then('the payload name should be {string}', function(this: TestWorld, expectedName: string) {
    expect(this.searchResult?.payload?.name || this.searchResults?.[0]?.payload?.name).toBe(expectedName);
});

Then('the payload version should be {string}', function(this: TestWorld, expectedVersion: string) {
    const result = this.searchResults?.[0];
    expect(result?.payload?.version || result?.version).toBe(expectedVersion);
});

Then('the remove operations should return true', function(this: TestWorld) {
    expect(this.removeResult).toBe(true);
});

Then('the remove operations should return true for the removed IDs', function(this: TestWorld) {
    if (typeof this.removeResult === 'object') {
        for (const value of Object.values(this.removeResult)) {
            expect(value).toBe(true);
        }
    } else {
        expect(this.removeResult).toBe(true);
    }
});

Then('listing all envelopes should show exactly {int} envelope(s)', async function(this: TestWorld, count: number) {
    const results = await this.repository!.list();
    expect(results.length).toBe(count);
});
