module.exports = {
    int: {
        requireModule: ['ts-node/register'],
        require: [
            '../../core/cert/src/support/**/*.ts',
            '../../core/cert/src/steps/**/*.ts',
            'test/integration/support/**/*.ts'
        ],
        paths: ['../../core/cert/features/integration/**/*.feature'],
        format: ['progress', 'json:test-results-bdd.json'],
        formatOptions: { snippetInterface: 'async-await' },
    },
    e2e: {
        requireModule: ['ts-node/register'],
        require: [
            '../../core/cert/src/support/**/*.ts',
            '../../core/cert/src/steps/**/*.ts',
            'test/e2e/support/**/*.ts'
        ],
        paths: ['../../core/cert/features/e2e/**/*.feature'],
        format: ['progress', 'json:test-results-bdd.json'],
        formatOptions: { snippetInterface: 'async-await' },
    }
};
