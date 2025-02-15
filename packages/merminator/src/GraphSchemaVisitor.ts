import { BaseCstVisitor } from "./parser";
import pluralize from "pluralize";
import { CstNode, IToken, CstElement } from "chevrotain";

interface GraphTypes {
  [key: string]: {
    fields: string[];
    methods: string[];
  };
}

interface GraphFiles {
  [key: string]: string[];
}

export class GraphSchemaVisitor extends BaseCstVisitor {
  constructor() {
    super();
    this.validateVisitor();
  }

  statementClause(ctx: CstNode): GraphFiles {
    const types: GraphTypes = {};
    ctx.children.classClause?.forEach((klass: CstElement) =>
      this.classClause(klass as CstNode, types)
    );
    ctx.children.compositionClause?.forEach((comp: CstElement) =>
      this.compositionClause(comp as CstNode, types)
    );
    const files: GraphFiles = {};

    for (const current_type in types) {
      files[current_type] = [];
      files[current_type].push("scalar Date");
      for (const type in types) {
        let fs: string[];
        if (current_type === type) {
          files[current_type].push(
            `type Query {\n  ${types[type].methods.join("\n  ")}\n}`
          );
          fs = types[type].fields;
        } else {
          fs = types[type].fields.filter(
            (field) => !field.includes(current_type)
          );
        }
        files[current_type].push(`type ${type} {\n  ${fs.join("\n  ")}\n}`);
      }
    }

    return files;
  }

  compositionClause(ctx: CstNode, types: GraphTypes): GraphTypes {
    const lhs = ctx.children.lhs[0] as IToken;
    const rhs = ctx.children.rhs[0] as IToken;
    const host = lhs.image;
    const type = rhs.image;

    if (!types[type]) {
      types[type] = { fields: [], methods: [] };
    }
    if (!types[host]) {
      types[host] = { fields: [], methods: [] };
    }

    const nme = pluralize(type.charAt(0).toLowerCase() + type.slice(1), 2);

    types[type].methods.push(`getBy${host}(id: ID, at: Float): [${type}]`);
    types[host].fields.push(`${nme}: [${type}]`);
    return types;
  }

  classClause(ctx: CstNode, types: GraphTypes): GraphTypes {
    const token = ctx.children.Type?.[0] as IToken;
    const type = token.image;
    const fields: string[] = [];

    ctx.children.fieldClause?.forEach((fc: CstElement) => {
      fields.push(this.fieldClause(fc as CstNode));
    });

    if ("annotatedFieldClause" in ctx.children) {
      ctx.children.annotatedFieldClause?.forEach((fc: CstElement) => {
        fields.push(this.annotatedFieldClause(fc as CstNode));
      });
    }

    const methods: string[] = [];
    if ("methodClause" in ctx.children) {
      ctx.children.methodClause?.forEach((mc: CstElement) => {
        methods.push(this.methodClause(mc as CstNode));
      });
    }
    methods.push(`getById(id: ID, at: Float): ${type}`);

    fields.push(`id: ID`);
    types[type] = { fields, methods };
    return types;
  }

  fieldClause(ctx: CstNode): string {
    const token = ctx.children.Identifier?.[0] as IToken;
    let name = token.image;
    if (name.endsWith("_id")) {
      name = name.slice(0, -3);
    }
    const type = this.typeClause(ctx.children.typeClause?.[0] as CstNode);
    return `${name}: ${type}`;
  }

  annotatedFieldClause(ctx: CstNode): string {
    return this.fieldClause(ctx);
  }

  typeClause(ctx: CstNode): string {
    if ("Type" in ctx.children) {
      const token = ctx.children.Type?.[0] as IToken;
      return token.image;
    } else if ("RequiredType" in ctx.children) {
      const token = ctx.children.RequiredType?.[0] as IToken;
      return token.image;
    } else if ("arrayClause" in ctx.children) {
      return this.arrayClause(ctx.children.arrayClause[0] as CstNode);
    }
    throw new Error("Invalid typeClause structure");
  }

  arrayClause(ctx: CstNode): string {
    const token = ctx.children.Type?.[0] as IToken;
    if (!token) throw new Error("Missing type in arrayClause");
    return `[${token.image}]`;
  }

  methodClause(ctx: CstNode): string {
    const fn = ctx.children.Identifier?.[0] as IToken;
    const returnType = this.typeClause(ctx.children.typeClause?.[0] as CstNode);
    const argList = this.argList(ctx.children.argList?.[0] as CstNode);
    return `${fn.image}(${argList.join(", ")}): ${returnType}`;
  }

  argList(ctx: CstNode): string[] {
    const token = ctx.children.Identifier?.[0] as IToken;
    const type = this.typeClause(ctx.children.typeClause?.[0] as CstNode);
    return [`${token.image}: ${type}`, "at: Float"];
  }

  varList(): void { }

  valueClause(): void { }
}
