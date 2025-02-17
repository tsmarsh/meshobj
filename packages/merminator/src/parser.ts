import { CstParser, Lexer, IToken, CstNode, ILexingResult } from 'chevrotain';
import {
    allTokens,
    Class,
    CloseArgList,
    CloseArray,
    CloseBlock,
    Colon,
    Comma,
    DoubleQuotedString,
    SingleQuotedString,
    Number,
    ComposedOf,
    Identifier,
    OpenArgList,
    OpenArray,
    OpenBlock,
    RequiredType,
    Type,
} from './lexer.js'; // Ensure TypeScript understands the import

import Log4js from 'log4js';

// Logger
const logger = Log4js.getLogger('gridql/RepositoryDiagram');

export class RepositoryDiagram extends CstParser {
    private lexer: Lexer;

    // ✅ Declare rule methods as class fields with arrow functions
    public statementClause = this.RULE('statementClause', () => {
        this.MANY(() => {
            this.OR([
                { ALT: () => this.SUBRULE(this.compositionClause) },
                { ALT: () => this.SUBRULE(this.classClause) },
            ]);
        });
    });

    public compositionClause = this.RULE('compositionClause', () => {
        this.CONSUME(Type, { LABEL: 'lhs' });
        this.CONSUME(ComposedOf);
        this.CONSUME2(Type, { LABEL: 'rhs' });
    });

    public classClause = this.RULE('classClause', () => {
        this.CONSUME(Class);
        this.CONSUME(Type);
        this.CONSUME(OpenBlock);
        this.MANY(() => {
            this.OR([{ ALT: () => this.SUBRULE(this.fieldClause) }, { ALT: () => this.SUBRULE(this.methodClause) }]);
        });
        this.CONSUME(CloseBlock);
    });

    public fieldClause = this.RULE('fieldClause', () => {
        this.CONSUME(Identifier);
        this.CONSUME(Colon);
        this.SUBRULE(this.typeClause);
        this.OPTION(() => {
            this.CONSUME(OpenArray);
            this.SUBRULE(this.varList);
            this.CONSUME(CloseArray);
        });
    });

    public typeClause = this.RULE('typeClause', () => {
        this.OR([
            { ALT: () => this.CONSUME(RequiredType) },
            { ALT: () => this.CONSUME2(Type) },
            { ALT: () => this.SUBRULE(this.arrayClause) },
        ]);
    });

    public arrayClause = this.RULE('arrayClause', () => {
        this.CONSUME(OpenArray);
        this.CONSUME(Type);
        this.CONSUME(CloseArray);
    });

    public methodClause = this.RULE('methodClause', () => {
        this.CONSUME(Identifier);
        this.CONSUME(OpenArgList);
        this.SUBRULE(this.argList);
        this.CONSUME(CloseArgList);
        this.CONSUME(Colon);
        this.SUBRULE(this.typeClause);
    });

    public argList = this.RULE('argList', () => {
        this.MANY_SEP({
            SEP: Comma,
            DEF: () => {
                this.CONSUME(Identifier);
                this.CONSUME(Colon);
                this.SUBRULE(this.typeClause);
            },
        });
    });

    public varList = this.RULE('varList', () => {
        this.MANY_SEP({
            SEP: Comma,
            DEF: () => {
                this.CONSUME(Identifier);
                this.CONSUME(Colon);
                this.SUBRULE(this.valueClause);
            },
        });
    });

    public valueClause = this.RULE('valueClause', () => {
        this.OR([
            { ALT: () => this.CONSUME(DoubleQuotedString) },
            { ALT: () => this.CONSUME(SingleQuotedString) },
            { ALT: () => this.CONSUME2(Number) },
        ]);
    });

    constructor() {
        super(allTokens);
        this.lexer = new Lexer(allTokens);

        // Perform self-analysis after defining all rules
        this.performSelfAnalysis();
    }

    // ✅ Type-safe parse function
    public parseInput(text: string): CstNode {
        const result: ILexingResult = this.lexer.tokenize(text);

        this.input = result.tokens as IToken[];
        const ctx = this.statementClause();

        if (this.errors.length > 0) {
            logger.error(JSON.stringify(this.errors, null, 2));
            throw new Error('Parsing Errors:\n' + this.errors[0].message);
        }

        return ctx;
    }
}

// Export Parser Instance
export const parser = new RepositoryDiagram();
export const BaseCstVisitor = parser.getBaseCstVisitorConstructor();
