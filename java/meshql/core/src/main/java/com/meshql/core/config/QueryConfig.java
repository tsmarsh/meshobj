package com.meshql.core.config;

import java.util.Optional;

public record QueryConfig(
    String name,
    Optional<String> id,
    String query
) {} 