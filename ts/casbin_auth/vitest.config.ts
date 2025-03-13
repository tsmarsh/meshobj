import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        setupFiles: [], // Path to the setup file
        coverage: {
            reportsDirectory: '../../coverage',
        },
    },
    esbuild: {
        loader: 'ts', // Use TypeScript loader
        target: 'es2022', // Align with `tsconfig.json`
    },
});
