import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        setupFiles: [], // Path to the setup file
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
        },
    },
    esbuild: {
        loader: "ts", // Use TypeScript loader
        target: "es2022", // Align with `tsconfig.json`
    }
});
