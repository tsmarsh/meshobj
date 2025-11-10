import { World } from '@cucumber/cucumber';
import { Repository, Envelope, Searcher } from '@meshobj/common';
import { TemplateDelegate } from 'handlebars';
import { Config, Plugin, StorageConfig } from '@meshobj/server';

export type SearcherTestTemplates = {
    findById: TemplateDelegate<{ id: string }>;
    findByName: TemplateDelegate<{ name: string }>;
    findAllByType: TemplateDelegate<{ type: string }>;
    findByNameAndType: TemplateDelegate<{ name: string; type: string }>;
}

export class IntegrationWorld extends World {
    //required from repository
    config?: StorageConfig;
    plugin?: Plugin;
    templates?: SearcherTestTemplates;

    //Used by steps
    envelopes?: Map<string, Envelope>;
    timestamps?: Map<string, number>;
    testStartTime?: number;
    searchResult?: any;
    searchResults?: any[];
    removeResult?:boolean;
    removeResults?: Record<string, boolean>;
    tokens?: string[];
}

export interface FarmTestWorld {
    app?: any;
    server?: any;
    config?: Config;
    token?: string;
    ids: Record<string, Record<string, string>>
    first_stamp?: number;
    queryResult?: any;
    now?: string;
    apis?: any;
}
