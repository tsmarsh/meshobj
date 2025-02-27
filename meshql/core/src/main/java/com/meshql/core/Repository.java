package com.meshql.core;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

public interface Repository {
    CompletableFuture<Envelope> create(Envelope envelope, List<String> tokens);
    CompletableFuture<Optional<Envelope>> read(String id, List<String> tokens, Instant createdAt);
    CompletableFuture<List<Envelope>> list(List<String> tokens);
    CompletableFuture<Boolean> remove(String id, List<String> tokens);
    CompletableFuture<List<Envelope>> createMany(List<Envelope> payloads, List<String> tokens);
    CompletableFuture<List<Envelope>> readMany(List<String> ids, List<String> tokens);
    CompletableFuture<Map<String, Boolean>> removeMany(List<String> ids, List<String> tokens);
}