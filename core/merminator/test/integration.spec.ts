import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { merminate } from '../src/processor';
import fs from 'fs';
import path from 'path';
import { validate as validateJsonSchema } from 'jsonschema';
import { buildSchema, validateSchema } from 'graphql';
const parser = require('@pushcorn/hocon-parser');
import { ConfigSchema } from '@meshobj/server';
import { J } from 'vitest/dist/chunks/reporters.nr4dxCkA.js';

describe('Merminator Integration Test', () => {
    const testDir = __dirname;
    const outputDir = path.join(testDir, 'output');
    const mermaidFile = path.join(testDir, 'test.mermaid');
    const testUrl = 'http://localhost:8080';

    // Create output directory before tests
    beforeAll(() => {
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        if (!fs.existsSync(path.join(outputDir, 'config'))) {
            fs.mkdirSync(path.join(outputDir, 'config'), { recursive: true });
        }
        if (!fs.existsSync(path.join(outputDir, 'config/json'))) {
            fs.mkdirSync(path.join(outputDir, 'config/json'), { recursive: true });
        }
        if (!fs.existsSync(path.join(outputDir, 'config/graph'))) {
            fs.mkdirSync(path.join(outputDir, 'config/graph'), { recursive: true });
        }

        merminate(mermaidFile, outputDir, testUrl);
    });

    // Clean up after tests
    afterAll(() => {
        if (fs.existsSync(outputDir)) {
            fs.rmSync(outputDir, { recursive: true, force: true });
        }
    });

    test('the config file is valid', async () => {
        const configPath = path.join(outputDir, 'config/config.conf');
        expect(fs.existsSync(configPath)).toBe(true);

        const configJson = await parser.parse({ url: configPath });

        const result = ConfigSchema.safeParse(configJson);
        if (!result.success) {
            console.error('Zod validation errors:', result.error);
        }
        expect(result.success).toBe(true);
    });

    test('the json schemas are valid', () => {
        // Verify JSON Schema files
        const jsonSchemaDir = path.join(outputDir, 'config/json');
        const jsonSchemaFiles = fs.readdirSync(jsonSchemaDir);
        expect(jsonSchemaFiles.length).toBe(3); // Farm, Coop, and Hen schemas

        // Validate each JSON Schema
        jsonSchemaFiles.forEach((file) => {
            const schemaContent = JSON.parse(fs.readFileSync(path.join(jsonSchemaDir, file), 'utf-8'));
            expect(() => validateJsonSchema({}, schemaContent)).not.toThrow();
        });
    });

    test('the graphql files are valid', () => {
        const graphqlDir = path.join(outputDir, 'config/graph');
        const graphqlFiles = fs.readdirSync(graphqlDir);
        expect(graphqlFiles.length).toBe(3); // Farm, Coop, and Hen schemas

        // Validate each GraphQL Schema
        graphqlFiles.forEach((file) => {
            const schemaContent = fs.readFileSync(path.join(graphqlDir, file), 'utf-8');
            const gqlSchema = buildSchema(schemaContent);
            expect(validateSchema(gqlSchema)).toEqual([]);
        });
    });
});
