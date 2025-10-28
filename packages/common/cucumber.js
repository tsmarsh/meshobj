module.exports = {
    default: {
        requireModule: ['ts-node/register'],
        require: ['test/steps/**/*.ts', 'test/support/**/*.ts'],
        format: ['progress', 'json:test-results.json'],
        formatOptions: { snippetInterface: 'async-await' },
    }
};
