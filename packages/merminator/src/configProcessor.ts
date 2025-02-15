import { Config, Restlette, Graphlette } from "@meshobj/server";
import { MongoConfig } from "@meshobj/mongo_repo";
import fs from "fs";
import { Types } from "./ConfiguratorConfigVisitor";

const mongo = (name: string): MongoConfig => {
  return {
    type: "mongo",
    uri: "${?MONGO_URI}",
    collection: '${?PREFIX}"-"${?ENV}"-' + name + '"',
    db: `$\{?PREFIX}"_"$\{?ENV}`,
    options: {
      directConnection: true,
    },
  };
};

const gen = (nodes: Types): Config => {
  const graphlettes: Graphlette[] = Object.entries(nodes).map(([name, dto]) => {
    return {
      path: `/${name}/graph`,
      storage: mongo(name),
      schema: fs.readFileSync(`config/graph/${name}.graphql`, 'utf8'),
      rootConfig: {
        singletons: [],
        vectors: [],
        resolvers: [],
      }
    };
  });

  const restlettes: Restlette[] = Object.keys(nodes).map((name) => {
    return {
      path: `/${name}/api`,
      storage: mongo(name),
      schema: JSON.parse(fs.readFileSync(`config/json/${name}.schema.json`, 'utf8')),
    };
  });
  return {
    graphlettes,
    port: 3033,
    restlettes
  };
};

export const processConfig = (nodes: Types): string => {
  const config: Config = gen(nodes);

  const data = JSON.stringify(config, null, 2);

  const unquoted = data.replace(/(".*":)\s"(.*\$\{\?.*}.*)"/gm, "$1 $2");

  return unquoted
    .split("\n")
    .map((line) => {
      if (line.includes("${?")) {
        return line.replace(/\\"/g, '"');
      }
      return line;
    })
    .join("\n");
};
