import { BaseCstVisitor } from './parser.js';
import { CstElement, CstNode, IToken } from 'chevrotain';

// Define JSON Schema types
interface JSONSchema {
  type: string;
  format?: string;
  additionalProperties?: boolean;
  required?: string[];
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  [key: string]: any;
}

export class JSONSchemaVisitor extends BaseCstVisitor {
  schemas: Record<string, JSONSchema>;

  constructor() {
    super();
    this.validateVisitor();
    this.schemas = {};
  }

  statementClause(ctx: any) {

    ctx.classClause?.forEach((klass: CstElement) => this.classClause(klass as CstNode));

    return this.schemas;
  }

  classClause(ctx: CstNode) {
    const token = ctx.children.Type?.[0] as IToken;

    const name = token.image;
    if (!name) throw new Error("Missing class name in classClause");

    const schema: JSONSchema = {
      type: "object",
      additionalProperties: false,
      required: [],
      properties: {
        id: {
          type: "string",
          format: "uuid",
        },
      },
    };

    this.schemas[name] = schema;

    ctx.children.fieldClause?.forEach((fc: CstElement) => this.fieldClause(fc as CstNode, schema));
    ctx.children.annotatedFieldClause?.forEach((fc: CstElement) =>
      this.annotatedFieldClause(fc as CstNode, schema),
    );
  }

  fieldClause(ctx: CstNode, schema: JSONSchema) {
    const token = ctx.children.Identifier?.[0] as IToken;
    const name = token.image;
    if (!name) throw new Error("Missing identifier in fieldClause");

    const typeToken = ctx.children.typeClause?.[0] as CstNode;

    const type = this.typeClause(typeToken, schema, name);

    if (name.endsWith("_id")) {
      schema.properties![name] = { type: "string", format: "uuid" };
    } else {
      if (ctx.children.varList) {
        this.varList(type, ctx.children.varList[0] as CstNode);
      }
      schema.properties![name] = type;
    }
  }

  annotatedFieldClause(ctx: CstNode, schema: JSONSchema) {
    this.fieldClause(ctx, schema);
  }

  typeClause(ctx?: CstNode, schema?: JSONSchema, name?: string): JSONSchema {
    if (!ctx) throw new Error("Missing typeClause context");

    if ("Type" in ctx.children) {
      const token = ctx.children.Type[0] as IToken;
      return this.isSpecial(token.image);
    } else if ("RequiredType" in ctx.children) {
      const token = ctx.children.RequiredType[0] as IToken;
      const image = token.image;
      const important = image.slice(0, -1);
      schema?.required?.push(name!);
      return this.isSpecial(important);
    } else if ("arrayClause" in ctx.children) {
      return this.arrayClause(ctx.children.arrayClause[0] as CstNode);
    }

    throw new Error("Invalid typeClause structure");
  }

  isSpecial(tipe: string): JSONSchema {
    const special: Record<string, JSONSchema> = {
      Date: { type: "string", format: "date" },
      ID: { type: "string", format: "uuid" },
      Int: { type: "integer" },
      Float: { type: "number" },
    };

    return special[tipe] || { type: tipe.toLowerCase() };
  }

  arrayClause(ctx: CstNode): JSONSchema {
    const token = ctx.children.Type[0] as IToken;
    const value = token.image.toLowerCase();
    if (!value) throw new Error("Missing type in arrayClause");

    return {
      type: "array",
      items: { type: value },
    };
  }

  methodClause() { }
  argList() { }
  compositionClause() { }

  varList(type: JSONSchema, v: CstNode) {
    v.children.Identifier?.forEach((idNode: CstElement, index: number) => {
      const token = idNode as IToken;
      const name: string = token.image;

      type[name] = this.valueClause(v.children.valueClause?.[index] as CstNode);
    });
  }

  valueClause(v: CstNode): string | number {
    if ("DoubleQuotedString" in v.children) {
      const token = v.children.DoubleQuotedString[0] as IToken;
      return token.image.slice(1, -1);
    } else if ("SingleQuotedString" in v.children) {
      const token = v.children.SingleQuotedString[0] as IToken;
      return token.image.slice(1, -1);
    } else if ("Number" in v.children) {
      const token = v.children.Number[0] as IToken;
      return parseFloat(token.image);
    }

    throw new Error("Invalid valueClause structure");
  }
}