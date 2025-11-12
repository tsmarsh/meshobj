module.exports = {
    default: {
        requireModule: ['ts-node/register'],
        require: ['src/steps/**/*.ts', 'src/support/**/*.ts'],
        format: ['progress', 'json:test-results.json'],
        formatOptions: { snippetInterface: 'async-await' },
    }
};
