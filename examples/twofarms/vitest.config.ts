import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        hookTimeout: 120000,
        testTimeout: 120000,
        coverage: {
            provider: 'v8',
            include: ['test/**/*.ts'],
            exclude: ['**/*.d.ts'],
            all: false,
        },
    },
});