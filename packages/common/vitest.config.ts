import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        setupFiles: [], // Path to the setup file
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            reportsDirectory: '../../coverage',
            exclude: [
                '**/dist/**', // Exclude all dist directories
                '**/node_modules/**', // Exclude node_modules
                '**/test/**', // Optionally exclude test directories
                '**/*.spec.ts', // Optionally exclude test files
            ],
        },
    },
    esbuild: {
        loader: "ts", // Use TypeScript loader
        target: "es2022", // Align with `tsconfig.json`
    }
});
