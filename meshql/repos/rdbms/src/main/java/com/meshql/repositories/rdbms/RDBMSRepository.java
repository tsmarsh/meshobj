package com.meshql.repositories.rdbms;

import com.fasterxml.uuid.Generators;
import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.Template;
import com.github.jknack.handlebars.io.ClassPathTemplateLoader;
import com.github.jknack.handlebars.io.TemplateLoader;
import com.meshql.core.Envelope;
import com.meshql.core.Repository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.sql.DataSource;
import java.io.IOException;
import java.sql.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.TimeUnit;

import static com.meshql.repositories.rdbms.Converters.*;

/**
 * PostgreSQL implementation of the Repository interface.
 */
public class RDBMSRepository implements Repository {
    private static final Logger logger = LoggerFactory.getLogger(RDBMSRepository.class);
    private static final int MAX_RETRIES = 5;
    private static final long RETRY_DELAY_MS = 2;

    private final DataSource dataSource;
    private final String tableName;
    private final Handlebars handlebars;
    private final Map<String, Template> sqlTemplates;

    /**
     * Constructor for PostgresRepository.
     *
     * @param dataSource DataSource for database connections
     * @param tableName  Name of the table to use for storage
     */
    public RDBMSRepository(DataSource dataSource, String tableName) {
        this.dataSource = dataSource;
        this.tableName = tableName;

        // Initialize Handlebars and templates
        TemplateLoader loader = new ClassPathTemplateLoader("/templates/sql", ".hbs");
        this.handlebars = new Handlebars(loader);
        this.sqlTemplates = initializeTemplates();
    }

    /**
     * Initialize SQL templates.
     *
     * @return Map of template names to compiled templates
     */
    private Map<String, Template> initializeTemplates() {
        Map<String, Template> templates = new HashMap<>();

        try {
            // Define SQL templates as strings
            Map<String, String> templateStrings = new HashMap<>();
            templateStrings.put("createExtension", "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";");

            templateStrings.put("createTable",
                    "CREATE TABLE IF NOT EXISTS {{tableName}} (" +
                            "    pk UUID DEFAULT uuid_generate_v4() PRIMARY KEY," +
                            "    id TEXT," +
                            "    payload JSONB," +
                            "    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()," +
                            "    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()," +
                            "    deleted BOOLEAN DEFAULT FALSE," +
                            "    authorized_tokens TEXT[]," +
                            "    CONSTRAINT {{tableName}}_id_created_at_uniq UNIQUE (id, created_at)" +
                            ");"
            );

            templateStrings.put("createIdIndex",
                    "CREATE INDEX IF NOT EXISTS idx_{{tableName}}_id ON {{tableName}} (id);"
            );

            templateStrings.put("createCreatedAtIndex",
                    "CREATE INDEX IF NOT EXISTS idx_{{tableName}}_created_at ON {{tableName}} (created_at);"
            );

            templateStrings.put("createDeletedIndex",
                    "CREATE INDEX IF NOT EXISTS idx_{{tableName}}_deleted ON {{tableName}} (deleted);"
            );

            templateStrings.put("createTokensIndex",
                    "CREATE INDEX IF NOT EXISTS idx_{{tableName}}_tokens ON {{tableName}} USING GIN (authorized_tokens);"
            );

            templateStrings.put("insert",
                    "INSERT INTO {{tableName}} (id, payload, created_at, updated_at, deleted, authorized_tokens) " +
                            "VALUES (?, ?::jsonb, NOW(), NOW(), FALSE, ?) " +
                            "RETURNING *;"
            );

            templateStrings.put("read",
                    "SELECT * FROM {{tableName}} WHERE id = ? AND deleted IS FALSE AND created_at <= ? " +
                            "{{#if hasTokens}}AND authorized_tokens && ?{{/if}} " +
                            "ORDER BY created_at DESC LIMIT 1;"
            );

            templateStrings.put("readMany",
                    "SELECT DISTINCT ON (id) * FROM {{tableName}} WHERE id = ANY(?) AND deleted IS FALSE " +
                            "{{#if hasTokens}}AND authorized_tokens && ?{{/if}} " +
                            "ORDER BY id, created_at DESC;"
            );

            templateStrings.put("remove",
                    "UPDATE {{tableName}} SET deleted = TRUE WHERE id = ? " +
                            "{{#if hasTokens}}AND authorized_tokens && ?{{/if}}"
            );

            templateStrings.put("removeMany",
                    "UPDATE {{tableName}} SET deleted = TRUE WHERE id = ANY(?) " +
                            "{{#if hasTokens}}AND authorized_tokens && ?{{/if}}"
            );

            templateStrings.put("list",
                    "SELECT DISTINCT ON (id) * FROM {{tableName}} WHERE deleted IS FALSE " +
                            "{{#if hasTokens}}AND authorized_tokens && ?{{/if}} " +
                            "ORDER BY id, created_at DESC;"
            );

            // Compile all templates
            for (Map.Entry<String, String> entry : templateStrings.entrySet()) {
                templates.put(entry.getKey(), handlebars.compileInline(entry.getValue()));
            }
        } catch (IOException e) {
            logger.error("Failed to initialize SQL templates", e);
            throw new RuntimeException("Failed to initialize SQL templates", e);
        }

        return templates;
    }

    /**
     * Initializes the database schema.
     *
     * @throws SQLException if a database access error occurs
     */
    public void initialize() throws SQLException {
        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement()) {

            Map<String, Object> context = new HashMap<>();
            context.put("tableName", tableName);

            // Create UUID extension if it doesn't exist
            stmt.execute(sqlTemplates.get("createExtension").apply(context));

            // Create table if it doesn't exist
            stmt.execute(sqlTemplates.get("createTable").apply(context));

            // Create indexes
            stmt.execute(sqlTemplates.get("createIdIndex").apply(context));
            stmt.execute(sqlTemplates.get("createCreatedAtIndex").apply(context));
            stmt.execute(sqlTemplates.get("createDeletedIndex").apply(context));
            stmt.execute(sqlTemplates.get("createTokensIndex").apply(context));

            logger.info("Initialized PostgreSQL repository with table: {}", tableName);
        } catch (IOException e) {
            throw new SQLException("Failed to render SQL template", e);
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

        try {
            Map<String, Object> context = new HashMap<>();
            context.put("tableName", tableName);

            String sql = sqlTemplates.get("insert").apply(context);

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
        } catch (IOException e) {
            logger.error("Failed to render SQL template", e);
            throw new RuntimeException("Failed to render SQL template", e);
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

        try {
            Map<String, Object> context = new HashMap<>();
            context.put("tableName", tableName);
            context.put("hasTokens", tokens != null && !tokens.isEmpty());

            String sql = sqlTemplates.get("read").apply(context);

            try (Connection conn = dataSource.getConnection();
                 PreparedStatement stmt = conn.prepareStatement(sql)) {

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
            }
        } catch (SQLException e) {
            logger.error("Error reading document: {}", e.getMessage(), e);
            return Optional.empty();
        } catch (IOException e) {
            logger.error("Failed to render SQL template", e);
            return Optional.empty();
        }
    }

    @Override
    public List<Envelope> readMany(List<String> ids, List<String> tokens) {
        if (ids == null || ids.isEmpty()) {
            return Collections.emptyList();
        }

        try {
            Map<String, Object> context = new HashMap<>();
            context.put("tableName", tableName);
            context.put("hasTokens", tokens != null && !tokens.isEmpty());

            String sql = sqlTemplates.get("readMany").apply(context);

            try (Connection conn = dataSource.getConnection();
                 PreparedStatement stmt = conn.prepareStatement(sql)) {

                Array idsArray = conn.createArrayOf("text", ids.toArray());
                stmt.setArray(1, idsArray);

                if (tokens != null && !tokens.isEmpty()) {
                    Array tokensArray = conn.createArrayOf("text", tokens.toArray());
                    stmt.setArray(2, tokensArray);
                }

                try (ResultSet rs = stmt.executeQuery()) {
                    return resultSetToEnvelopes(rs);
                }
            }
        } catch (SQLException e) {
            logger.error("Error reading multiple documents: {}", e.getMessage(), e);
            return Collections.emptyList();
        } catch (IOException e) {
            logger.error("Failed to render SQL template", e);
            return Collections.emptyList();
        }
    }

    @Override
    public Boolean remove(String id, List<String> tokens) {
        try {
            Map<String, Object> context = new HashMap<>();
            context.put("tableName", tableName);
            context.put("hasTokens", tokens != null && !tokens.isEmpty());

            String sql = sqlTemplates.get("remove").apply(context);

            try (Connection conn = dataSource.getConnection();
                 PreparedStatement stmt = conn.prepareStatement(sql)) {

                stmt.setString(1, id);

                if (tokens != null && !tokens.isEmpty()) {
                    Array tokensArray = conn.createArrayOf("text", tokens.toArray());
                    stmt.setArray(2, tokensArray);
                }

                stmt.executeUpdate();
                return true;
            }
        } catch (SQLException e) {
            logger.error("Error removing document: {}", e.getMessage(), e);
            return false;
        } catch (IOException e) {
            logger.error("Failed to render SQL template", e);
            return false;
        }
    }

    @Override
    public Map<String, Boolean> removeMany(List<String> ids, List<String> tokens) {
        if (ids == null || ids.isEmpty()) {
            return Collections.emptyMap();
        }

        try {
            Map<String, Object> context = new HashMap<>();
            context.put("tableName", tableName);
            context.put("hasTokens", tokens != null && !tokens.isEmpty());

            String sql = sqlTemplates.get("removeMany").apply(context);

            try (Connection conn = dataSource.getConnection();
                 PreparedStatement stmt = conn.prepareStatement(sql)) {

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
            }
        } catch (SQLException e) {
            logger.error("Error removing multiple documents: {}", e.getMessage(), e);

            // Return all IDs as failed
            Map<String, Boolean> result = new HashMap<>();
            for (String id : ids) {
                result.put(id, false);
            }
            return result;
        } catch (IOException e) {
            logger.error("Failed to render SQL template", e);

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
        try {
            Map<String, Object> context = new HashMap<>();
            context.put("tableName", tableName);
            context.put("hasTokens", tokens != null && !tokens.isEmpty());

            String sql = sqlTemplates.get("list").apply(context);

            try (Connection conn = dataSource.getConnection();
                 PreparedStatement stmt = conn.prepareStatement(sql)) {

                if (tokens != null && !tokens.isEmpty()) {
                    Array tokensArray = conn.createArrayOf("text", tokens.toArray());
                    stmt.setArray(1, tokensArray);
                }

                try (ResultSet rs = stmt.executeQuery()) {
                    return resultSetToEnvelopes(rs);
                }
            }
        } catch (SQLException e) {
            logger.error("Error listing documents: {}", e.getMessage(), e);
            return Collections.emptyList();
        } catch (IOException e) {
            logger.error("Failed to render SQL template", e);
            return Collections.emptyList();
        }
    }
}