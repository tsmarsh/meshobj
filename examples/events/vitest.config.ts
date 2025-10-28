import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        hookTimeout: 120000,
        testTimeout: 120000,
        coverage: {
            provider: 'v8',
            include: ['test/**/*.spec.ts', 'test/**/*.wip.ts', 'src/**/*.ts'],
            exclude: ['**/*.d.ts', '**/*.js', '**/coverage/**'],
            all: false,
        },
    },
});