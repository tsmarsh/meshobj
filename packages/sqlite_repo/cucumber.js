module.exports = {
    default: {
        requireModule: ['ts-node/register'],
        require: [
            '../common/test/support/**/*.ts',
            '../common/test/steps/**/*.ts',
            'test/support/**/*.ts'
        ],
        paths: ['../common/test/features/**/*.feature'],
        format: ['progress', 'json:test-results-bdd.json'],
        formatOptions: { snippetInterface: 'async-await' },
    }
};
