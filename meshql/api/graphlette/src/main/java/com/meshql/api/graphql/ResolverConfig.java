package com.meshql.api.graphql;

public record ResolverConfig(
    String name,
    String id,
    String queryName,
    String url
) {}