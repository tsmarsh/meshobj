import { JSONSchemaVisitor } from "./JSONSchemaVisitor.js";
import fs from "fs";
import { GraphSchemaVisitor } from "./GraphSchemaVisitor.js";
import { ConfiguratorConfigVisitor, Types } from "./ConfiguratorConfigVisitor.js";
import { processConfig } from "./configProcessor.js";
import { parser } from "./parser.js";
import { CstNode } from "chevrotain";

export function processJsonSchema(ctx: CstNode, destinationPath: string) {
  const jsonSchemaVisitor = new JSONSchemaVisitor();
  let jsonschemas = jsonSchemaVisitor.visit(ctx);
  for (let schema in jsonschemas) {
    let fname = `${destinationPath}/config/json/${schema.toLowerCase()}.schema.json`
    console.log(fname)
    fs.writeFileSync(
      fname,
      JSON.stringify(jsonschemas[schema], null, 2),
    );
  }
}

export function processGraphQLSchema(ctx: CstNode, destinationPath: string) {
  const graphSchemaVisitor = new GraphSchemaVisitor();
  let graphSchema = graphSchemaVisitor.visit(ctx);
  for (let schema in graphSchema) {
    let fname = `${destinationPath}/config/graph/${schema.toLowerCase()}.graphql`
    console.log(fname)
    fs.writeFileSync(
      fname,
      graphSchema[schema].join("\n\n"),
    );
  }
}

export function processClusterConfig(ctx: CstNode, host: string, destinationPath: string) {
  const configuratorConfigVisitor = new ConfiguratorConfigVisitor(host);
  let config: Types = configuratorConfigVisitor.visit(ctx)
  let configString = processConfig(config, destinationPath)
  let fname = `${destinationPath}/config/config.conf`
  console.log(fname)
  fs.writeFileSync(
    fname,
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