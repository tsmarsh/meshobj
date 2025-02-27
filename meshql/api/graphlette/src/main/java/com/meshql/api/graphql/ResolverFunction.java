package com.meshql.api.graphql;

import graphql.schema.DataFetchingEnvironment;

import java.util.Map;
import java.util.concurrent.CompletableFuture;

@FunctionalInterface
public interface ResolverFunction {
    CompletableFuture<Map<String, Object>> resolve(
            Map<String, Object> parent,
            DataFetchingEnvironment env
    );
}