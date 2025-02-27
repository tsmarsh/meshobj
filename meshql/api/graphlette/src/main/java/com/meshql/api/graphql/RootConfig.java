package com.meshql.api.graphql;

import java.util.List;

public record RootConfig(
    List<ResolverConfig> resolvers,
    List<QueryConfig> singletons,
    List<QueryConfig> vectors
) {} 