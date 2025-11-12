import { Given } from '@cucumber/cucumber';
import { IntegrationWorld } from '../support/worlds';

Given('I capture the current timestamp as {string}', function(this: IntegrationWorld, label: string) {
    this.timestamps!.set(label, Date.now());
});

Given('I wait {int} milliseconds', async function(this: any, ms: number) {
    await new Promise(resolve => setTimeout(resolve, ms));
});