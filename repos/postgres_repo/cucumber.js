module.exports = {
    default: {
        requireModule: ['ts-node/register'],
        require: [
            '../../packages/common/test/support/**/*.ts',
            '../../packages/common/test/steps/**/*.ts',
            'test/support/**/*.ts'
        ],
        paths: ['../../packages/common/test/features/**/*.feature'],
        format: ['progress', 'json:test-results-bdd.json'],
        formatOptions: { snippetInterface: 'async-await' },
    }
};
