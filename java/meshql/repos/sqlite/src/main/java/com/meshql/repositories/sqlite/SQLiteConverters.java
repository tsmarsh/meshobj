package com.meshql.repositories.sqlite;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.meshql.core.Envelope;
import com.tailoredshapes.stash.Stash;

import java.sql.*;
import java.time.Instant;
import java.util.*;

/**
 * Utility class for converting between JDBC ResultSet objects and domain
 * objects specific to SQLite.
 */
public class SQLiteConverters {
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    /**
     * Converts a ResultSet row to an Envelope object.
     *
     * @param rs ResultSet positioned at the row to convert
     * @return Envelope object
     * @throws SQLException if a database access error occurs
     */
    public static Envelope resultSetToEnvelope(ResultSet rs) throws SQLException {
        if (rs == null) {
            return null;
        }

        String id = rs.getString("id");
        
        // SQLite stores timestamps as milliseconds since epoch
        long createdAtMillis = rs.getLong("created_at");
        Instant createdAt = Instant.ofEpochMilli(createdAtMillis);
        
        boolean deleted = rs.getInt("deleted") != 0;

        // Convert JSON payload to Stash
        String payloadJson = rs.getString("payload");
        Stash payload = null;
        if (payloadJson != null) {
            try {
                Map<String, Object> payloadMap = OBJECT_MAPPER.readValue(payloadJson, Map.class);
                payload = new Stash();
                for (Map.Entry<String, Object> entry : payloadMap.entrySet()) {
                    payload.put(entry.getKey(), entry.getValue());
                }
            } catch (JsonProcessingException e) {
                throw new SQLException("Failed to parse JSON payload", e);
            }
        }

        // Get authorized tokens
        List<String> authorizedTokens = new ArrayList<>();
        String tokensJson = rs.getString("authorized_tokens");
        if (tokensJson != null && !tokensJson.isEmpty() && !tokensJson.equals("null")) {
            try {
                String[] tokens = OBJECT_MAPPER.readValue(tokensJson, String[].class);
                authorizedTokens = Arrays.asList(tokens);
            } catch (JsonProcessingException e) {
                throw new SQLException("Failed to parse JSON tokens", e);
            }
        }

        return new Envelope(id, payload, createdAt, deleted, authorizedTokens);
    }


    /**
     * Converts a list of ResultSet rows to a list of Envelope objects.
     *
     * @param rs ResultSet containing the rows to convert
     * @return List of Envelope objects
     * @throws SQLException if a database access error occurs
     */
    public static List<Envelope> resultSetToEnvelopes(ResultSet rs) throws SQLException {
        List<Envelope> envelopes = new ArrayList<>();
        while (rs.next()) {
            envelopes.add(resultSetToEnvelope(rs));
        }
        return envelopes;
    }

    /**
     * Converts a timestamp to a long milliseconds value.
     *
     * @param timestamp Timestamp
     * @return Long value representing milliseconds since epoch
     */
    public static Long timestampToMillis(Timestamp timestamp) {
        return timestamp != null ? timestamp.getTime() : null;
    }

    /**
     * Converts milliseconds to a Timestamp object.
     *
     * @param millis Milliseconds since epoch
     * @return SQL Timestamp
     */
    public static Timestamp millisToTimestamp(long millis) {
        return new Timestamp(millis);
    }

    /**
     * Converts an Instant to milliseconds.
     *
     * @param instant Instant
     * @return Milliseconds since epoch
     */
    public static long instantToMillis(Instant instant) {
        return instant != null ? instant.toEpochMilli() : System.currentTimeMillis();
    }
} 