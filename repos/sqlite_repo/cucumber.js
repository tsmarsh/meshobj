module.exports = {
    default: {
        requireModule: ['ts-node/register'],
        require: [
            '../../core/common/test/support/**/*.ts',
            '../../core/common/test/steps/**/*.ts',
            'test/support/**/*.ts'
        ],
        paths: ['../../core/common/test/features/**/*.feature'],
        format: ['progress', 'json:test-results-bdd.json'],
        formatOptions: { snippetInterface: 'async-await' },
        publishQuiet: true
    }
};
