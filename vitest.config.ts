import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        coverage: {
            provider: 'v8',
            exclude: [
                '**/*.d.ts',
                '**/*.js',
                '**/test/**',
                '**/coverage/**',
                '**/dist/**',
                '**/node_modules/**',
                '**/*.config.*',
                '**/cucumber.js',
            ],
            all: false,
        },
    },
});
