module.exports = {
    default: {
        requireModule: ['ts-node/register'],
        require: [
            '../common/test/steps/**/*.ts',
            'test/support/**/*.ts'
        ],
        import: ['../common/test/features/**/*.feature'],
        format: ['progress', 'json:test-results-bdd.json'],
        formatOptions: { snippetInterface: 'async-await' },
    }
};
