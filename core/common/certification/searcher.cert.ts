import {Envelope, Searcher} from "../index";
import {TemplateDelegate} from "handlebars";

export type TestTemplates = {
    findById: TemplateDelegate,
    findByName: TemplateDelegate,
    findAllByType: TemplateDelegate,
    findByNameAndType: TemplateDelegate,
}

export type Testvelope<I> = Envelope<I> & {
    payload: {name: string, count: number, type: "A" | "B"};
}

export function SearcherCertification<I>(createStore: (data: Envelope<string>[]) => Promise<{saved: Envelope<string>[], searcher: Searcher<string>}>,
                             tearDown: () => Promise<void>,
                             templates: TestTemplates,
                                tokens: string[] = ["TOKEN"]) {
    let searcher: Searcher<I>;
    let saved: Envelope<I>[] = []

    beforeEach(async () => {
        const testData: Testvelope<I>[] = [
            {payload: {name: "Bruce", count: 1, type: "A"}}, {payload: {name: "Charlie", count: 2, type: "A"}},
            {payload: {name: "Danny", count: 3, type: "A"}}, {payload: {name: "Ewan", count: 4, type: "A"}},
            {payload: {name: "Fred", count: 5, type: "B"}}, {payload: {name: "Greg", count: 6, type: "B"}},
            {payload: {name: "Henry", count: 7, type: "B"}}, {payload: {name: "Ian", count: 8, type: "B"}}];

        let store = await createStore(testData);
        searcher = store.searcher;
        saved = store.saved;
    });

    afterAll(async () => {
        await tearDown();
    })

    test("should find by id", async () => {
        const id = saved[0].id!

        const result = await searcher.find(templates["findById"], {id});

        expect(result.name).toEqual("Bruce")
        expect(result.count).toEqual(1)
    });
}