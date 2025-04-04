package com.meshql.server;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.meshql.core.Config;
import com.meshql.core.config.*;
import com.meshql.repos.sqlite.SQLiteConfig;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SpecVersion;

import java.net.URI;
import java.util.List;

import static com.tailoredshapes.underbar.io.IO.resource;
import static com.tailoredshapes.underbar.io.IO.slurp;
import static com.tailoredshapes.underbar.ocho.Die.rethrow;
import static com.tailoredshapes.underbar.ocho.UnderBar.list;
import static java.util.Optional.empty;
import static java.util.Optional.of;

public class SQLRoot {
    private static JsonSchemaFactory factory = JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V7);
    private static ObjectMapper objectMapper = new ObjectMapper();

    public static Config config(int port) {
        StorageConfig farmStorage = new SQLiteConfig(
                "thefarm.db",
                "farm"
        );

        StorageConfig coopStorage = new SQLiteConfig(
                "thefarm.db",
                "coop"
        );
        StorageConfig henStorage = new SQLiteConfig(
                "thefarm.db",
                "hen"
        );

        RootConfig farmConfig = new RootConfig(
                list(new ResolverConfig("coops", empty(), "getByFarm", rethrow(() -> new URI("/coop/graph")))),
                list(new QueryConfig("getById", empty(), "id = '{{id}}'")),
                list()
        );

        RootConfig coopConfig = new RootConfig(
                list(new ResolverConfig("farm", of("farm_id"), "getById", rethrow(() -> new URI("/farm/graph"))),
                        new ResolverConfig("hens", empty(), "getByCoop", rethrow(() -> new URI("/hen/graph")))),
                list(new QueryConfig("getByName", of("name"), "json_extract(payload, '$.name') = '{{id}}'"),
                        new QueryConfig("getById", empty(), "id = '{{id}}'")),
                list(new QueryConfig("getByFarm", empty(), "json_extract(payload, '$.farm_id') = '{{id}}'"))
        );

        RootConfig henConfig = new RootConfig(
                list(new ResolverConfig("coop", of("coop_id"), "getById", rethrow(() -> new URI("/coop/graph")))),
                list(new QueryConfig("getById", empty(), "id = '{{id}}'")),
                list(new QueryConfig("getByName", empty(), "json_extract(payload, '$.name') = '{{name}}'"),
                        new QueryConfig("getByCoop", empty(), "json_extract(payload, '$.coop_id') = '{{id}}'"))
        );

        List<GraphletteConfig> graphlettes = list(
                new GraphletteConfig("farm", farmStorage, slurp(SQLRoot.class.getResourceAsStream("/config/graph/farm.graphql")), farmConfig),
                new GraphletteConfig("coop", coopStorage, slurp(SQLRoot.class.getResourceAsStream("/config/graph/coop.graphql")), coopConfig),
                new GraphletteConfig("hen", henStorage, slurp(SQLRoot.class.getResourceAsStream("/config/graph/hen.graphql")), henConfig)
        );

        List<RestletteConfig> restlettes = list(
                new RestletteConfig(list(), "farm", port, farmStorage, toSchema("/config/json/farm.schema.json")),
                new RestletteConfig(list(), "coop", port, farmStorage, toSchema("/config/json/coop.schema.json")),
                new RestletteConfig(list(), "hen", port, farmStorage, toSchema("/config/json/hen.schema.json"))
        );

        return new Config(list(), graphlettes, port, restlettes);
    }

    private static JsonSchema toSchema(String resource) {
        String schema = slurp(SQLRoot.class.getResourceAsStream("/config/json/farm.schema.json"));
        JsonNode schemaNode = objectMapper.valueToTree(schema);
        return factory.getSchema(schemaNode);
    }
}
