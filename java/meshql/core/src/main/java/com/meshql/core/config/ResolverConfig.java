package com.meshql.core.config;

import java.net.URI;
import java.util.Optional;


public record ResolverConfig(
        String name,
        Optional<String> id,
        String queryName,
        URI url
) {}