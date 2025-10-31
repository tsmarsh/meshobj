import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['test/**/*.spec.ts', 'test/**/*.bdd.ts', 'test/**/*.wip.ts'],
        hookTimeout: 120000,
        testTimeout: 120000,
        fileParallelism: false, // Run test files sequentially to avoid docker port conflicts
        coverage: {
            provider: 'v8',
            include: ['test/**/*.spec.ts', 'test/**/*.bdd.ts', 'test/**/*.wip.ts', 'src/**/*.ts'],
            exclude: ['**/*.d.ts', '**/*.js', '**/coverage/**'],
            all: false,
        },
    },
});