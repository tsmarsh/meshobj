import { World, IWorldOptions, setWorldConstructor } from '@cucumber/cucumber';
import { Repository, Envelope, Searcher } from '../../src';
import { TemplateDelegate } from 'handlebars';

export class TestWorld extends World {
    repository?: Repository;
    searcher?: Searcher;
    templates?: Record<string, TemplateDelegate>;
    envelopes: Map<string, Envelope>;
    timestamps: Map<string, number>;
    testStartTime: number;
    searchResult?: any;
    searchResults?: any[];
    removeResult?: boolean | Record<string, boolean>;
    createRepository?: () => Promise<Repository>;
    createSearcher?: () => Promise<{ repository: Repository; searcher: Searcher }>;
    tearDown?: () => Promise<void>;
    tokens: string[];

    constructor(options: IWorldOptions) {
        super(options);
        this.envelopes = new Map();
        this.timestamps = new Map();
        this.testStartTime = Date.now();
        this.tokens = ['TOKEN'];
    }
}

setWorldConstructor(TestWorld);
