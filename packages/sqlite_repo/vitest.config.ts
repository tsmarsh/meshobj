import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        typecheck: {
            enabled: true,
            checker: 'tsc',
        },
        globals: true,
        environment: 'node',
        coverage: {
            reportsDirectory: '../../coverage',
        },
    },
    esbuild: {
        format: 'esm',
        loader: 'ts', // Use TypeScript loader
        target: 'es2022', // Align with `tsconfig.json`
    },
});
