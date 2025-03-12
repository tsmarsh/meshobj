package com.meshql.repositories.postgres;

import com.fasterxml.uuid.Generators;
import com.meshql.core.Envelope;
import com.meshql.core.Repository;
import com.tailoredshapes.stash.Stash;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.sql.DataSource;
import java.sql.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.TimeUnit;

import static com.meshql.repositories.postgres.Converters.*;
import static com.tailoredshapes.underbar.ocho.UnderBar.*;

/**
 * PostgreSQL implementation of the Repository interface.
 */
public class PostgresRepository implements Repository {
    private static final Logger logger = LoggerFactory.getLogger(PostgresRepository.class);
    private static final int MAX_RETRIES = 5;
    private static final long RETRY_DELAY_MS = 2;

    private final DataSource dataSource;
    private final String tableName;

    /**
     * Constructor for PostgresRepository.
     *
     * @param dataSource DataSource for database connections
     * @param tableName  Name of the table to use for storage
     */
    public PostgresRepository(DataSource dataSource, String tableName) {
        this.dataSource = dataSource;
        this.tableName = tableName;
    }

    /**
     * Initializes the database schema.
     *
     * @throws SQLException if a database access error occurs
     */
    public void initialize() throws SQLException {
        try (Connection conn = dataSource.getConnection();
                Statement stmt = conn.createStatement()) {

            // Create UUID extension if it doesn't exist
            stmt.execute("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";");

            // Create table if it doesn't exist
            String createTableSql = String.format(
                    "CREATE TABLE IF NOT EXISTS %s (" +
                            "    pk UUID DEFAULT uuid_generate_v4() PRIMARY KEY," +
                            "    id TEXT," +
                            "    payload JSONB," +
                            "    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()," +
                            "    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()," +
                            "    deleted BOOLEAN DEFAULT FALSE," +
                            "    authorized_tokens TEXT[]," +
                            "    CONSTRAINT %s_id_created_at_uniq UNIQUE (id, created_at)" +
                            ");",
                    tableName, tableName);
            stmt.execute(createTableSql);

            // Create indexes
            stmt.execute(String.format(
                    "CREATE INDEX IF NOT EXISTS idx_%s_id ON %s (id);",
                    tableName, tableName));

            stmt.execute(String.format(
                    "CREATE INDEX IF NOT EXISTS idx_%s_created_at ON %s (created_at);",
                    tableName, tableName));

            stmt.execute(String.format(
                    "CREATE INDEX IF NOT EXISTS idx_%s_deleted ON %s (deleted);",
                    tableName, tableName));

            stmt.execute(String.format(
                    "CREATE INDEX IF NOT EXISTS idx_%s_tokens ON %s USING GIN (authorized_tokens);",
                    tableName, tableName));

            logger.info("Initialized PostgreSQL repository with table: {}", tableName);
        }
    }

    @Override
    public Envelope create(Envelope envelope, List<String> tokens) {
        return createWithRetry(envelope, tokens, 0);
    }

    /**
     * Creates a document with retry logic for handling unique constraint
     * violations.
     *
     * @param envelope   Envelope to create
     * @param tokens     Authorization tokens
     * @param retryCount Current retry count
     * @return Created envelope
     */
    private Envelope createWithRetry(Envelope envelope, List<String> tokens, int retryCount) {
        String id = envelope.id() != null ? envelope.id() : Generators.timeBasedGenerator().generate().toString();

        String sql = String.format(
                "INSERT INTO %s (id, payload, created_at, updated_at, deleted, authorized_tokens) " +
                        "VALUES (?, ?::jsonb, NOW(), NOW(), FALSE, ?) " +
                        "RETURNING *;",
                tableName);

        try (Connection conn = dataSource.getConnection();
                PreparedStatement stmt = conn.prepareStatement(sql)) {

            stmt.setString(1, id);
            stmt.setString(2, stashToJson(envelope.payload()));

            // Convert tokens list to array
            if (tokens != null && !tokens.isEmpty()) {
                Array tokensArray = conn.createArrayOf("text", tokens.toArray());
                stmt.setArray(3, tokensArray);
            } else {
                stmt.setNull(3, Types.ARRAY);
            }

            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    return resultSetToEnvelope(rs);
                } else {
                    throw new SQLException("Failed to create document, no rows returned");
                }
            }
        } catch (SQLException e) {
            // PostgreSQL unique violation error code is 23505
            if (e.getSQLState() != null && e.getSQLState().equals("23505") && retryCount < MAX_RETRIES) {
                try {
                    TimeUnit.MILLISECONDS.sleep(RETRY_DELAY_MS);
                    return createWithRetry(envelope, tokens, retryCount + 1);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw new RuntimeException("Interrupted during retry", ie);
                }
            }
            logger.error("Error creating document: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to create document", e);
        }
    }

    @Override
    public List<Envelope> createMany(List<Envelope> envelopes, List<String> tokens) {
        List<Envelope> created = new ArrayList<>();
        for (Envelope envelope : envelopes) {
            created.add(create(envelope, tokens));
        }
        return created;
    }

    @Override
    public Optional<Envelope> read(String id, List<String> tokens, Instant createdAt) {
        if (createdAt == null) {
            createdAt = Instant.now();
        }

        StringBuilder sql = new StringBuilder(String.format(
                "SELECT * FROM %s WHERE id = ? AND deleted IS FALSE AND created_at <= ?",
                tableName));

        if (tokens != null && !tokens.isEmpty()) {
            sql.append(" AND authorized_tokens && ?");
        }

        sql.append(" ORDER BY created_at DESC LIMIT 1;");

        try (Connection conn = dataSource.getConnection();
                PreparedStatement stmt = conn.prepareStatement(sql.toString())) {

            stmt.setString(1, id);
            stmt.setTimestamp(2, instantToTimestamp(createdAt));

            if (tokens != null && !tokens.isEmpty()) {
                Array tokensArray = conn.createArrayOf("text", tokens.toArray());
                stmt.setArray(3, tokensArray);
            }

            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(resultSetToEnvelope(rs));
                } else {
                    return Optional.empty();
                }
            }
        } catch (SQLException e) {
            logger.error("Error reading document: {}", e.getMessage(), e);
            return Optional.empty();
        }
    }

    @Override
    public List<Envelope> readMany(List<String> ids, List<String> tokens) {
        if (ids == null || ids.isEmpty()) {
            return Collections.emptyList();
        }

        StringBuilder sql = new StringBuilder(String.format(
                "SELECT DISTINCT ON (id) * FROM %s WHERE id = ANY(?) AND deleted IS FALSE",
                tableName));

        if (tokens != null && !tokens.isEmpty()) {
            sql.append(" AND authorized_tokens && ?");
        }

        sql.append(" ORDER BY id, created_at DESC;");

        try (Connection conn = dataSource.getConnection();
                PreparedStatement stmt = conn.prepareStatement(sql.toString())) {

            Array idsArray = conn.createArrayOf("text", ids.toArray());
            stmt.setArray(1, idsArray);

            if (tokens != null && !tokens.isEmpty()) {
                Array tokensArray = conn.createArrayOf("text", tokens.toArray());
                stmt.setArray(2, tokensArray);
            }

            try (ResultSet rs = stmt.executeQuery()) {
                return resultSetToEnvelopes(rs);
            }
        } catch (SQLException e) {
            logger.error("Error reading multiple documents: {}", e.getMessage(), e);
            return Collections.emptyList();
        }
    }

    @Override
    public Boolean remove(String id, List<String> tokens) {
        StringBuilder sql = new StringBuilder(String.format(
                "UPDATE %s SET deleted = TRUE WHERE id = ?",
                tableName));

        if (tokens != null && !tokens.isEmpty()) {
            sql.append(" AND authorized_tokens && ?");
        }

        try (Connection conn = dataSource.getConnection();
                PreparedStatement stmt = conn.prepareStatement(sql.toString())) {

            stmt.setString(1, id);

            if (tokens != null && !tokens.isEmpty()) {
                Array tokensArray = conn.createArrayOf("text", tokens.toArray());
                stmt.setArray(2, tokensArray);
            }

            stmt.executeUpdate();
            return true;
        } catch (SQLException e) {
            logger.error("Error removing document: {}", e.getMessage(), e);
            return false;
        }
    }

    @Override
    public Map<String, Boolean> removeMany(List<String> ids, List<String> tokens) {
        if (ids == null || ids.isEmpty()) {
            return Collections.emptyMap();
        }

        StringBuilder sql = new StringBuilder(String.format(
                "UPDATE %s SET deleted = TRUE WHERE id = ANY(?)",
                tableName));

        if (tokens != null && !tokens.isEmpty()) {
            sql.append(" AND authorized_tokens && ?");
        }

        try (Connection conn = dataSource.getConnection();
                PreparedStatement stmt = conn.prepareStatement(sql.toString())) {

            Array idsArray = conn.createArrayOf("text", ids.toArray());
            stmt.setArray(1, idsArray);

            if (tokens != null && !tokens.isEmpty()) {
                Array tokensArray = conn.createArrayOf("text", tokens.toArray());
                stmt.setArray(2, tokensArray);
            }

            stmt.executeUpdate();

            // Return all IDs as successfully removed
            Map<String, Boolean> result = new HashMap<>();
            for (String id : ids) {
                result.put(id, true);
            }
            return result;
        } catch (SQLException e) {
            logger.error("Error removing multiple documents: {}", e.getMessage(), e);

            // Return all IDs as failed
            Map<String, Boolean> result = new HashMap<>();
            for (String id : ids) {
                result.put(id, false);
            }
            return result;
        }
    }

    @Override
    public List<Envelope> list(List<String> tokens) {
        StringBuilder sql = new StringBuilder(String.format(
                "SELECT DISTINCT ON (id) * FROM %s WHERE deleted IS FALSE",
                tableName));

        if (tokens != null && !tokens.isEmpty()) {
            sql.append(" AND authorized_tokens && ?");
        }

        sql.append(" ORDER BY id, created_at DESC;");

        try (Connection conn = dataSource.getConnection();
                PreparedStatement stmt = conn.prepareStatement(sql.toString())) {

            if (tokens != null && !tokens.isEmpty()) {
                Array tokensArray = conn.createArrayOf("text", tokens.toArray());
                stmt.setArray(1, tokensArray);
            }

            try (ResultSet rs = stmt.executeQuery()) {
                return resultSetToEnvelopes(rs);
            }
        } catch (SQLException e) {
            logger.error("Error listing documents: {}", e.getMessage(), e);
            return Collections.emptyList();
        }
    }
}