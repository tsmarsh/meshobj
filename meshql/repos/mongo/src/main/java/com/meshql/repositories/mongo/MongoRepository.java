package com.meshql.repositories.mongo;

import com.fasterxml.uuid.Generators;
import com.meshql.core.Envelope;
import com.meshql.core.Repository;
import com.mongodb.WriteConcern;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.*;
import com.tailoredshapes.stash.Stash;
import com.tailoredshapes.underbar.ocho.UnderBar;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

import static com.tailoredshapes.underbar.ocho.UnderBar.filter;
import static com.tailoredshapes.underbar.ocho.UnderBar.map;


public class MongoRepository implements Repository {
    private static final Logger logger = LoggerFactory.getLogger(MongoRepository.class);
    private final MongoCollection<Document> collection;

    /**
     * Constructor for MongoRepository.
     *
     * @param collection MongoDB collection to use for storage
     */
    public MongoRepository(MongoCollection<Document> collection) {
        this.collection = collection;
    }

    /**
     * Applies security filters to a MongoDB query based on authorization tokens.
     *
     * @param tokens List of authorization tokens
     * @param filter The existing filter to enhance with security
     * @return The enhanced filter with security constraints
     */
    private Bson secureRead(List<String> tokens, Bson filter) {
        if (tokens != null && !tokens.isEmpty()) {
            return Filters.and(filter, Filters.in("authorizedTokens", tokens));
        }
        return filter;
    }

    /**
     * Converts a MongoDB Document to an Envelope.
     *
     * @param doc MongoDB Document
     * @return Envelope object
     */
    private Envelope documentToEnvelope(Document doc) {
        if (doc == null) {
            return null;
        }

        String id = doc.getString("id");
        Instant createdAt = doc.getDate("createdAt").toInstant();
        boolean deleted = doc.getBoolean("deleted", false);

        // Convert MongoDB Document to Stash
        Document payloadDoc = doc.get("payload", Document.class);
        Stash payload = payloadDoc != null ? documentToStash(payloadDoc) : null;

        // Get authorized tokens
        List<String> authorizedTokens = doc.getList("authorizedTokens", String.class, Collections.emptyList());

        return new Envelope(id, payload, createdAt, deleted, authorizedTokens);
    }

    /**
     * Converts a MongoDB Document to a Stash object.
     *
     * @param doc MongoDB Document
     * @return Stash object
     */
    private Stash documentToStash(Document doc) {
        Map<String, Object> map = new HashMap<>();
        for (String key : doc.keySet()) {
            Object value = doc.get(key);
            if (value instanceof Document) {
                map.put(key, documentToStash((Document) value));
            } else {
                map.put(key, value);
            }
        }
        // Create a new Stash with the map contents
        Stash stash = new Stash();
        for (Map.Entry<String, Object> entry : map.entrySet()) {
            stash.put(entry.getKey(), entry.getValue());
        }
        return stash;
    }

    /**
     * Converts an Envelope to a MongoDB Document.
     *
     * @param envelope Envelope to convert
     * @return MongoDB Document
     */
    private Document envelopeToDocument(Envelope envelope) {
        Document doc = new Document();
        doc.put("id", envelope.id());
        doc.put("createdAt", Date.from(envelope.createdAt()));
        doc.put("deleted", envelope.deleted());

        if (envelope.authorizedTokens() != null) {
            doc.put("authorizedTokens", envelope.authorizedTokens());
        }

        if (envelope.payload() != null) {
            doc.put("payload", stashToDocument(envelope.payload()));
        }

        return doc;
    }

    /**
     * Converts a Stash object to a MongoDB Document.
     *
     * @param stash Stash to convert
     * @return MongoDB Document
     */
    private Document stashToDocument(Stash stash) {
        Document doc = new Document();
        for (String key : stash.keySet()) {
            Object value = stash.get(key);
            if (value instanceof Stash) {
                doc.put(key, stashToDocument((Stash) value));
            } else {
                doc.put(key, value);
            }
        }
        return doc;
    }

    @Override
    public Envelope create(Envelope envelope, List<String> tokens) {
        // Generate a new envelope with current timestamp and UUID if needed
        String id = envelope.id() != null ? envelope.id() : Generators.timeBasedGenerator().generate().toString();
        Instant createdAt = Instant.now();

        Envelope newEnvelope = new Envelope(
                id,
                envelope.payload(),
                createdAt,
                false,
                tokens);

        try {
            Document doc = envelopeToDocument(newEnvelope);
            collection.withWriteConcern(WriteConcern.MAJORITY).insertOne(doc);
            return newEnvelope;
        } catch (Exception e) {
            logger.error("Error creating document: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to create document", e);
        }
    }

    @Override
    public List<Envelope> createMany(List<Envelope> envelopes, List<String> tokens) {
        Instant createdAt = Instant.now();
        List<Document> documents = new ArrayList<>();
        List<Envelope> createdEnvelopes = new ArrayList<>();

        for (Envelope envelope : envelopes) {
            String id = UUID.randomUUID().toString();
            Envelope newEnvelope = new Envelope(
                    id,
                    envelope.payload(),
                    createdAt,
                    false,
                    tokens);

            documents.add(envelopeToDocument(newEnvelope));
            createdEnvelopes.add(newEnvelope);
        }

        try {
            collection.insertMany(documents);
            return createdEnvelopes;
        } catch (Exception e) {
            logger.error("Error creating multiple documents: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to create multiple documents", e);
        }
    }

    @Override
    public Optional<Envelope> read(String id, List<String> tokens, Instant createdAt) {
        if (createdAt == null) {
            createdAt = Instant.now();
        }

        Bson filter = Filters.and(
                Filters.eq("id", id),
                Filters.lte("createdAt", Date.from(createdAt)),
                Filters.eq("deleted", false));

        filter = secureRead(tokens, filter);

        try {
            List<Document> results = collection.find(filter)
                    .sort(Sorts.descending("createdAt"))
                    .into(new ArrayList<>());

            if (results.isEmpty()) {
                return Optional.empty();
            }

            return Optional.ofNullable(documentToEnvelope(results.get(0)));
        } catch (Exception e) {
            logger.error("Error reading document: {}", e.getMessage(), e);
            return Optional.empty();
        }
    }

    @Override
    public List<Envelope> readMany(List<String> ids, List<String> tokens) {
        Bson match = Filters.and(
                Filters.in("id", ids),
                Filters.eq("deleted", false));

        match = secureRead(tokens, match);

        try {
            List<Document> results = collection.aggregate(UnderBar.list(
                    Aggregates.match(match),
                    Aggregates.sort(Sorts.descending("createdAt")),
                    Aggregates.group("$id", new BsonField("doc",  new Document("$first", "$$ROOT"))),
                    Aggregates.replaceRoot("$doc"))).into(new ArrayList<>());

            return results.stream()
                    .map(this::documentToEnvelope)
                    .filter(Objects::nonNull)
                    .collect(Collectors.toList());
        } catch (Exception e) {
            logger.error("Error reading multiple documents: {}", e.getMessage(), e);
            return Collections.emptyList();
        }
    }

    @Override
    public Boolean remove(String id, List<String> tokens) {
        try {
            Bson filter = secureRead(tokens, Filters.eq("id", id));
            collection.updateMany(filter, Updates.set("deleted", true));
            return true;
        } catch (Exception e) {
            logger.error("Error removing document: {}", e.getMessage(), e);
            return false;
        }
    }

    @Override
    public Map<String, Boolean> removeMany(List<String> ids, List<String> tokens) {
        try {
            Bson filter = secureRead(tokens, Filters.in("id", ids));
            collection.updateMany(filter, Updates.set("deleted", true));

            // Return all IDs as successfully removed
            // Note: This is a simplification similar to the TypeScript implementation
            return ids.stream().collect(Collectors.toMap(id -> id, id -> true));
        } catch (Exception e) {
            logger.error("Error removing multiple documents: {}", e.getMessage(), e);
            return ids.stream().collect(Collectors.toMap(id -> id, id -> false));
        }
    }

    @Override
    public List<Envelope> list(List<String> tokens) {
        Bson match = secureRead(tokens, Filters.eq("deleted", false));

        try {
            List<Document> results = collection.aggregate(UnderBar.list(
                    Aggregates.match(match),
                    Aggregates.sort(Sorts.descending("createdAt")),
                    Aggregates.group("$id", new BsonField("doc", new Document("$first", "$$ROOT"))),
                    Aggregates.replaceRoot("$doc"))).into(new ArrayList<>());

            return filter(map(results, this::documentToEnvelope), Objects::nonNull);

        } catch (Exception e) {
            logger.error("Error listing documents: {}", e.getMessage(), e);
            return Collections.emptyList();
        }
    }
}