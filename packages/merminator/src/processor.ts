import { JSONSchemaVisitor } from "./JSONSchemaVisitor";
import fs from "fs";
import { GraphSchemaVisitor } from "./GraphSchemaVisitor";
import { ConfiguratorConfigVisitor, Types } from "./ConfiguratorConfigVisitor";
import { processConfig } from "./configProcessor";
import { parser } from "./parser";
import { CstNode } from "chevrotain";

export function processJsonSchema(ctx: CstNode, destinationPath: string) {
  const jsonSchemaVisitor = new JSONSchemaVisitor();
  let jsonschemas = jsonSchemaVisitor.visit(ctx);
  for (let schema in jsonschemas) {
    fs.writeFileSync(
      `${destinationPath}/config/json/${schema.toLowerCase()}.schema.json`,
      JSON.stringify(jsonschemas[schema], null, 2),
    );
  }
}

export function processGraphQLSchema(ctx: CstNode, destinationPath: string) {
  const graphSchemaVisitor = new GraphSchemaVisitor();
  let graphSchema = graphSchemaVisitor.visit(ctx);
  for (let schema in graphSchema) {
    fs.writeFileSync(
      `${destinationPath}/config/graph/${schema.toLowerCase()}.graphql`,
      graphSchema[schema].join("\n\n"),
    );
  }
}

export function processClusterConfig(ctx: CstNode, host: string, destinationPath: string) {
  const configuratorConfigVisitor = new ConfiguratorConfigVisitor(host);
  let config: Types = configuratorConfigVisitor.visit(ctx)
  let configString = processConfig(config)
  fs.writeFileSync(
    `${destinationPath}/config/config.conf`,
    configString,
  );
}

export const merminate = (filePath: string, destinationPath: string, url: string) => {
  let mermaid = fs.readFileSync(filePath, { encoding: "utf-8" });

  const ctx: CstNode = parser.parseInput(mermaid);

  fs.mkdirSync(destinationPath + "/config/graph", { recursive: true });
  fs.mkdirSync(destinationPath + "/config/json", { recursive: true });
  processJsonSchema(ctx, destinationPath);
  processGraphQLSchema(ctx, destinationPath);
  processClusterConfig(ctx, url, destinationPath);
};
