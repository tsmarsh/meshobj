import { createToken, Lexer } from "chevrotain";

const DiagramType = createToken({
    name: "DiagramType",
    pattern: /classDiagram/,
    group: Lexer.SKIPPED,
});

export const RequiredType = createToken({
    name: "RequiredType",
    pattern: /[A-Z][a-zA-Z]*!/,
});

export const Type = createToken({
    name: "Type",
    pattern: /[A-Z][a-zA-Z]*/,
    longer_alt: RequiredType,
});

export const Identifier = createToken({
    name: "Identifier",
    pattern: /[a-z]\w*/,
    longer_alt: Type,
});

export const Class = createToken({
    name: "Class",
    pattern: /class/,
    longer_alt: Identifier,
});

export const OpenBlock = createToken({ name: "OpenBlock", pattern: /\{/ });
export const CloseBlock = createToken({ name: "CloseBlock", pattern: /}/ });
export const OpenArray = createToken({ name: "OpenArray", pattern: /\[/ });
export const CloseArray = createToken({ name: "CloseArray", pattern: /]/ });
export const OpenArgList = createToken({ name: "OpenArgList", pattern: /\(/ });
export const CloseArgList = createToken({
    name: "CloseArgList",
    pattern: /\)/,
});

export const Colon = createToken({ name: "Colon", pattern: /:/ });
export const Comma = createToken({ name: "Comma", pattern: /,/ });
export const DoubleQuotedString = createToken({
    name: "DoubleQuotedString",
    pattern: /"[^"]*"/,
});

export const SingleQuotedString = createToken({
    name: "SingleQuotedString",
    pattern: /'[^']*'/,
});
export const Number = createToken({ name: "Number", pattern: /\d+\.\d+|\d+/ });
export const ComposedOf = createToken({ name: "ComposedOf", pattern: /\*--/ });

const WhiteSpace = createToken({
    name: "WhiteSpace",
    pattern: /\s+/,
    group: Lexer.SKIPPED,
});

const AnyCharacter = createToken({
    name: "AnyCharacter",
    pattern: /./,
    group: Lexer.SKIPPED, // This will skip the token during parsing.
});

export const allTokens = [
    WhiteSpace,
    DiagramType,
    Class,
    RequiredType,
    Type,
    Identifier,
    OpenBlock,
    CloseBlock,
    OpenArray,
    CloseArray,
    Colon,
    Comma,
    DoubleQuotedString,
    SingleQuotedString,
    Number,
    ComposedOf,
    OpenArgList,
    CloseArgList,
    AnyCharacter,
];
