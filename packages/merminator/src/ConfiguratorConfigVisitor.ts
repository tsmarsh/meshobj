import { BaseCstVisitor } from "./parser.js";
import pluralize from "pluralize";
import { CstElement, CstNode, IToken } from "chevrotain";
import { RootConfig } from "@meshobj/common";

interface FieldConfig extends RootConfig {
  fields: string[];
}

export interface Types {
  [key: string]: RootConfig;
}

export class ConfiguratorConfigVisitor extends BaseCstVisitor {
  private host: string;

  constructor(host = "http://localhost:3033") {
    super();
    this.host = host;
    this.validateVisitor();
  }

  graphUrl(node: string): string {
    return `${this.host}/${node}/graph`;
  }

  private getById = {
    name: "getById",
    query: '{"id": "{{id}}"}',
  };

  private getByX(x: string): string {
    const type = x.slice("getBy".length);
    return `{"payload.${type.charAt(0).toLowerCase() + type.slice(1)}": "{{id}}"}`;
  }

  private getByXid(x: string): string {
    const type = x.slice("getBy".length);
    return `{"payload.${type.charAt(0).toLowerCase() + type.slice(1)}_id": "{{id}}"}`;
  }

  statementClause(ctx: CstNode): Types {
    const types: Types = {};
    if (ctx.children) {
      ctx.children.classClause?.forEach((klass: CstElement) => this.classClause(klass as CstNode, types));
      ctx.children.compositionClause?.forEach((comp: CstElement) => this.compositionClause(comp as CstNode, types));
    }
    return types;
  }

  compositionClause(ctx: CstNode, types: Types): Types {
    let lhs = ctx.children.lhs[0] as IToken
    let rhs = ctx.children.rhs[0] as IToken
    const host = lhs.image;
    const type = rhs.image;
    const service = type.charAt(0).toLowerCase() + type.slice(1);
    const nme = pluralize(service, 2);

    if (!types[type.toLowerCase()]) {
      types[type.toLowerCase()] = { singletons: [], vectors: [], resolvers: [] };
    }
    if (!types[host.toLowerCase()]) {
      types[host.toLowerCase()] = { singletons: [], vectors: [], resolvers: [] };
    }

    types[type.toLowerCase()].vectors?.push({
      name: `getBy${host}`,
      query: `{"payload.${host.charAt(0).toLowerCase() + host.slice(1)}_id": "{{id}}"}`,
    });

    types[host.toLowerCase()].resolvers?.push({
      name: nme,
      queryName: "getBy" + host,
      url: this.graphUrl(service),
    });

    return types;
  }

  classClause(ctx: CstNode, types: Types): Types {
    const rootConfig: FieldConfig = { fields: [], singletons: [], vectors: [], resolvers: [] };

    const token = ctx.children.Type?.[0] as IToken;
    const type = token.image.toLowerCase();

    if (!types[type]) {
      types[type] = { singletons: [], vectors: [], resolvers: [] };
    }

    ctx.children.fieldClause?.forEach((fc: CstElement) => this.fieldClause(fc as CstNode, rootConfig));

    if ("annotatedFieldClause" in ctx.children) {
      ctx.children.annotatedFieldClause?.forEach((fc: CstElement) =>
        this.annotatedFieldClause(fc as CstNode, rootConfig)
      );
    }

    if ("methodClause" in ctx.children) {
      ctx.children.methodClause?.forEach((mc: CstElement) => this.methodClause(mc as CstNode, rootConfig));
    }

    rootConfig.singletons?.push(this.getById);
    const { fields, ...rest } = rootConfig;
    types[type] = rest;
    return types;
  }

  fieldClause(ctx: CstNode, rootConfig: FieldConfig): void {
    const token = ctx.children.Identifier?.[0] as IToken;
    const name = token.image;
    if (name.endsWith("_id")) {
      const service = name.substring(0, name.length - 3);

      rootConfig.resolvers?.push({
        name: service,
        id: name,
        queryName: "getById",
        url: this.graphUrl(service),
      });
    } else {
      rootConfig.fields.push(name);
    }
  }

  annotatedFieldClause(ctx: CstNode, fieldConfig: FieldConfig): void {
    this.fieldClause(ctx, fieldConfig);
  }

  typeClause(ctx: CstNode): string {
    if (!ctx) throw new Error("Missing typeClause context");

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

  returnTypeClause(ctx: CstNode, fn: string, id: string, rootConfig: FieldConfig): string | RootConfig {
    if ("Type" in ctx.children) {
      rootConfig.singletons?.push({
        name: fn,
        id: id,
        query: this.getByX(fn),
      });
      const token = ctx.children.Type?.[0] as IToken;
      return token.image;
    } else if ("arrayClause" in ctx.children) {
      rootConfig.vectors?.push({
        name: fn,
        query: rootConfig.fields.includes(id)
          ? `{"payload.${id}": "{{${id}}}"}`
          : this.getByXid(fn),
      });
    }
    return rootConfig;
  }

  arrayClause(ctx: CstNode): string {
    if (!ctx.children.Type?.[0]) throw new Error("Missing type in arrayClause");
    const token = ctx.children.Type?.[0] as IToken;
    return `[${token.image}]`;
  }

  methodClause(ctx: CstNode, fieldConfig: FieldConfig): string | RootConfig {
    if (!ctx.children.Identifier?.[0]) throw new Error("Missing identifier in methodClause");
    if (!ctx.children.argList?.[0]) throw new Error("Missing argList in methodClause");
    if (!ctx.children.typeClause?.[0]) throw new Error("Missing typeClause in methodClause");

    const fn = ctx.children.Identifier?.[0] as IToken;
    const id = this.argList(ctx.children.argList[0] as CstNode);
    return this.returnTypeClause(ctx.children.typeClause[0] as CstNode, fn.image, id, fieldConfig);
  }

  argList(ctx: CstNode): string {
    if (!ctx.children.Identifier?.[0]) throw new Error("Missing identifier in argList");
    const token = ctx.children.Identifier?.[0] as IToken;
    return token.image;
  }

  varList(): void { }

  valueClause(): void { }
}