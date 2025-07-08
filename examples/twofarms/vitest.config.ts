import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        hookTimeout: 120000, // this is what you’re missing
        testTimeout: 120000, // optional, for consistency
    },
});