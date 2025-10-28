import { defineWorkspace } from 'vitest/config';

export default defineWorkspace(
    [
        './packages/*/vitest.config.ts',
        './repos/*/vitest.config.ts',
        './examples/*/vitest.config.ts'
    ]
);