package com.meshql.server;

import com.meshql.api.graphql.DTOFactory;
import com.meshql.api.graphql.Graphlette;
import com.meshql.api.graphql.Root;
import com.meshql.api.restlette.JSONSchemaValidator;
import com.meshql.api.restlette.Restlette;

import com.meshql.core.*;
import com.meshql.core.config.GraphletteConfig;
import com.meshql.core.config.RestletteConfig;
import graphql.schema.DataFetcher;
import spark.Service;

import java.util.Map;

public class Server {

    private final Auth auth;
    private final Map<String, Plugin> storageFactory;

    public Server(Auth auth, Map<String, Plugin> storageFactory) {
        this.auth = auth;
        this.storageFactory = storageFactory;
    }

    public Service init(Config config) {
        Service service = Service.ignite().port(config.port());

        for(RestletteConfig rc : config.restlettes()){
            JSONSchemaValidator validator = new JSONSchemaValidator(rc.schema());

            Restlette.init(service, rc, storageFactory, auth, validator);
        }

        for(GraphletteConfig gc : config.graphlettes()){
            Plugin plugin = storageFactory.get(gc.storage().type);
            Searcher searcher = plugin.createSearcher(gc.storage());
            DTOFactory dtoFactory = new DTOFactory(gc.rootConfig().resolvers());
            Map<String, DataFetcher> fetchers = Root.create(searcher, dtoFactory, auth, gc.rootConfig());
            new Graphlette(service,
                    fetchers,
                    gc.schema(),
                    gc.path());
        }
        return service;
    }
}
