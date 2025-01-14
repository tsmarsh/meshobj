import { describe, it, beforeEach, afterAll, expect } from 'vitest';
import { Repository, Envelope, Id, Payload } from "../index";

export function numvelop(payload: Payload): Envelope<number> { return { payload }; }
export function strinvelop(payload: Payload): Envelope<string> { return { payload }; }

export function RepositoryCertification<I>(
    createRepository: () => Promise<Repository<I>>,
    tearDown: () => Promise<void>,
    enveloper: (payload: Payload) => Envelope<I>
) {
    let repository: Repository<I>;

    beforeEach(async () => {
        repository = await createRepository();
    });

    afterAll(async () => {
        await tearDown();
    });

    describe('Repository Certification Tests', () => {
        it('create should store and return the envelope', async () => {
            const data: Payload = { name: "Create Test", count: 3 };
            const now = new Date();

            const envelope = enveloper(data);

            const result = await repository.create(envelope);
            expect(result.id).not.toBeNull();
            expect(result.createdAt?.getTime()).toBeGreaterThanOrEqual(now.getTime());
            expect(result.deleted).toBeFalsy();
        });

        it('read should retrieve an existing envelope by ID', async () => {
            const data: Payload = { name: "Read Test", count: 51 };
            const envelope = enveloper(data);

            const create_result: Envelope<I> = await repository.create(envelope);
            const id: Id<I> = create_result.id!;

            const result = await repository.read(id);

            expect(result.payload.name).toEqual("Read Test");
        });

        it('list should retrieve all created envelopes', async () => {
            const envelopes = [
                { name: "test1", count: 4 },
                { name: "test2", count: 45 },
                { name: "test3", count: 2 }
            ].map(enveloper);

            await Promise.all(envelopes.map((e) => repository.create(e)));

            const result = await repository.list();
            expect(result).toHaveLength(envelopes.length);
        });

        it('remove should delete an envelope by ID', async () => {
            const data: Payload = { name: "Read Test", count: 51 };
            const envelope = enveloper(data);

            const create_result: Envelope<I> = await repository.create(envelope);
            const id: Id<I> = create_result.id!;

            const result = await repository.remove(id);
            expect(result).toBe(true);

            expect(await repository.read(id)).toBeUndefined();
        });

        it('createMany should store multiple envelopes', async () => {
            const envelopes = [
                { name: "test1", count: 4 },
                { name: "test2", count: 45 },
                { name: "test3", count: 2 }
            ].map(enveloper);

            const result = await repository.createMany(envelopes);
            expect(result.length).toEqual(envelopes.length);
        });

        it('readMany should retrieve multiple envelopes by IDs', async () => {
            const envelopes = [
                { name: "test1", count: 4 },
                { name: "test2", count: 45 },
                { name: "test3", count: 2 }
            ].map(enveloper);

            const create_result = await repository.createMany(envelopes);

            const result = await repository.readMany(create_result.slice(0, 2).map((e) => e.id!));

            expect(result.length).toEqual(2);
        });

        it('removeMany should delete multiple envelopes by IDs', async () => {
            const envelopes = [
                { name: "test1", count: 4 },
                { name: "test2", count: 45 },
                { name: "test3", count: 2 }
            ].map(enveloper);

            const create_result = await repository.createMany(envelopes);

            const ids = create_result.map((e) => e.id!);
            const to_delete = ids.slice(0, 2);
            const result = await repository.removeMany(to_delete);

            to_delete.forEach((id) => expect(result[id]).toBe(true));

            const listed = await repository.list();
            expect(listed).toHaveLength(1);
        });
    });
}
