import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        setupFiles: ["./test/setup.ts"], // Path to the setup file
        coverage: {
            provider: "c8",
            reporter: ["text", "json", "html"],
        },
    },
});