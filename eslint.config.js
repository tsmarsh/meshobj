import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
    // Base config for all files
    {
        ignores: [
            '**/dist/**',
            '**/node_modules/**',
            '**/*.js', // Ignore compiled output
            '**/coverage/**',
            'vitest.workspace.packages',
            '**/vitest.config.packages',
            '**/test/**',
        ],
    },
    {
        files: ['**/*.packages'],
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                project: ['./tsconfig.json', './packages/*/tsconfig.json'],
                tsconfigRootDir: import.meta.dirname,
            },
            globals: {
                ...globals.node,
                ...globals.es2021,
            },
        },
        plugins: {
            '@typescript-eslint': tseslint,
        },
        rules: {
            ...eslint.configs.recommended.rules,
            ...tseslint.configs['recommended'].rules,
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-var-requires': 'off',
            // Add your custom rules here
            // "@typescript-eslint/no-explicit-any": "warn"
        },
    },
    // Test files specific configuration
    {
        files: ['**/*.test.packages', '**/*.spec.packages'],
        languageOptions: {
            globals: {
                ...globals.jest,
                describe: 'readonly',
                it: 'readonly',
                expect: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly',
                beforeAll: 'readonly',
                afterAll: 'readonly',
            },
        },
        rules: {
            // Add any test-specific rules here
        },
    },
];
