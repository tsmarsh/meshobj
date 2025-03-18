package com.meshql.repositories.sqlite;

import com.fasterxml.uuid.Generators;
import com.github.jknack.handlebars.Template;
import com.meshql.core.Envelope;
import com.meshql.repositories.rdbms.RDBMSRepository;
import com.meshql.repositories.rdbms.RequiredTemplates;
import com.tailoredshapes.stash.Stash;
import com.tailoredshapes.underbar.ocho.UnderBar;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.sql.DataSource;
import java.io.IOException;
import java.sql.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.TimeUnit;

import static com.meshql.repositories.sqlite.SQLiteConverters.*;
import static com.tailoredshapes.underbar.ocho.Die.rethrow;
import static com.tailoredshapes.underbar.ocho.UnderBar.map;
import static com.tailoredshapes.underbar.ocho.UnderBar.modifyValues;

public class SQLiteRepository extends RDBMSRepository {
    private static final Logger logger = LoggerFactory.getLogger(SQLiteRepository.class);
    private static final int MAX_RETRIES = 5;
    private static final long RETRY_DELAY_MS = 2;

    private final DataSource dataSource;
    private final String tableName;
    private final RequiredTemplates sqlTemplates;

    /**
     * Constructor for SQLiteRepository.
     *
     * @param dataSource DataSource for database connections
     * @param tableName  Name of the table to use for storage
     */
    public SQLiteRepository(DataSource dataSource, String tableName) {
        super(dataSource, tableName);
        this.dataSource = dataSource;
        this.tableName = tableName;
        this.sqlTemplates = initializeTemplates();
    }

    @Override
    public RequiredTemplates initializeTemplates() {
        // Define SQL templates as strings
        Map<String, String> templateStrings = new HashMap<>();
        var createScripts = UnderBar.list(
                "CREATE TABLE IF NOT EXISTS {{tableName}} (" +
                        "    pk INTEGER PRIMARY KEY AUTOINCREMENT," +
                        "    id TEXT," +
                        "    payload TEXT," +
                        "    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)," +
                        "    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)," +
                        "    deleted INTEGER DEFAULT 0," +
                        "    UNIQUE (id, created_at)" +
                        ");",
                "CREATE INDEX IF NOT EXISTS idx_{{tableName}}_id ON {{tableName}} (id);",
                "CREATE INDEX IF NOT EXISTS idx_{{tableName}}_created_at ON {{tableName}} (created_at);",
                "CREATE INDEX IF NOT EXISTS idx_{{tableName}}_deleted ON {{tableName}} (deleted);",
                "CREATE TABLE IF NOT EXISTS {{tableName}}_authtokens (" +
                        "    envelope_id TEXT NOT NULL," +
                        "    envelope_created_at INTEGER NOT NULL," +
                        "    token TEXT NOT NULL," +
                        "    token_order INTEGER NOT NULL," +
                        "    PRIMARY KEY (envelope_id, envelope_created_at, token)," +
                        "    FOREIGN KEY (envelope_id, envelope_created_at) " +
                        "        REFERENCES {{tableName}} (id, created_at) ON DELETE CASCADE" +
                        ");",
                "CREATE INDEX IF NOT EXISTS idx_{{tableName}}_authtokens_token ON {{tableName}}_authtokens (token);",
                "CREATE INDEX IF NOT EXISTS idx_{{tableName}}_authtokens_order ON {{tableName}}_authtokens (envelope_id, envelope_created_at, token_order);"
        );

        templateStrings.put("insert",
                "INSERT INTO {{tableName}} (id, payload, created_at, updated_at, deleted) " +
                        "VALUES (?, ?, (strftime('%s', 'now') * 1000), (strftime('%s', 'now') * 1000), 0) " +
                        "RETURNING *, NULL AS authorized_tokens;"
        );

        templateStrings.put("insertToken",
                "INSERT INTO {{tableName}}_authtokens (envelope_id, envelope_created_at, token, token_order) " +
                        "VALUES (?, ?, ?, ?);"
        );

        templateStrings.put("read",
                "SELECT e.*, " +
                        "    (SELECT json_group_array(token) FROM " +
                        "        (SELECT token FROM {{tableName}}_authtokens " +
                        "         WHERE envelope_id = e.id AND envelope_created_at = e.created_at " +
                        "         ORDER BY token_order)) AS authorized_tokens " +
                        "FROM {{tableName}} e " +
                        "WHERE e.id = ? AND e.deleted = 0 AND e.created_at <= ? " +
                        "{{#if hasTokens}}AND EXISTS (SELECT 1 FROM {{tableName}}_authtokens " +
                        "                            WHERE envelope_id = e.id AND envelope_created_at = e.created_at " +
                        "                            AND token IN ({{#each tokens}}{{#unless @first}},{{/unless}}?{{/each}})){{/if}} " +
                        "ORDER BY e.created_at DESC LIMIT 1;"
        );

        templateStrings.put("readMany",
                "WITH latest_versions AS (" +
                        "    SELECT DISTINCT id, MAX(created_at) AS max_created_at " +
                        "    FROM {{tableName}} " +
                        "    WHERE id IN ({{#each ids}}{{#unless @first}},{{/unless}}?{{/each}}) AND deleted = 0 " +
                        "    {{#if hasTokens}}AND EXISTS (SELECT 1 FROM {{tableName}}_authtokens " +
                        "                                WHERE envelope_id = id AND envelope_created_at = created_at " +
                        "                                AND token IN ({{#each tokens}}{{#unless @first}},{{/unless}}?{{/each}})){{/if}} " +
                        "    GROUP BY id" +
                        ") " +
                        "SELECT e.*, " +
                        "    (SELECT json_group_array(token) FROM " +
                        "        (SELECT token FROM {{tableName}}_authtokens " +
                        "         WHERE envelope_id = e.id AND envelope_created_at = e.created_at " +
                        "         ORDER BY token_order)) AS authorized_tokens " +
                        "FROM {{tableName}} e " +
                        "JOIN latest_versions lv ON e.id = lv.id AND e.created_at = lv.max_created_at " +
                        "WHERE e.deleted = 0;"
        );

        templateStrings.put("remove",
                "UPDATE {{tableName}} SET deleted = 1 WHERE id = ? " +
                        "{{#if hasTokens}}AND EXISTS (SELECT 1 FROM {{tableName}}_authtokens " +
                        "                           WHERE envelope_id = id AND envelope_created_at = created_at " +
                        "                           AND token IN ({{#each tokens}}{{#unless @first}},{{/unless}}?{{/each}})){{/if}};"
        );

        templateStrings.put("removeMany",
                "UPDATE {{tableName}} SET deleted = 1 " +
                        "WHERE id IN ({{#each ids}}{{#unless @first}},{{/unless}}?{{/each}}) " +
                        "{{#if hasTokens}}AND EXISTS (SELECT 1 FROM {{tableName}}_authtokens " +
                        "                           WHERE envelope_id = id AND envelope_created_at = created_at " +
                        "                           AND token IN ({{#each tokens}}{{#unless @first}},{{/unless}}?{{/each}})){{/if}};"
        );

        templateStrings.put("list",
                "WITH latest_versions AS (" +
                        "    SELECT DISTINCT id, MAX(created_at) AS max_created_at " +
                        "    FROM {{tableName}} " +
                        "    WHERE deleted = 0 " +
                        "    {{#if hasTokens}}AND EXISTS (SELECT 1 FROM {{tableName}}_authtokens " +
                        "                                WHERE envelope_id = id AND envelope_created_at = created_at " +
                        "                                AND token IN ({{#each tokens}}{{#unless @first}},{{/unless}}?{{/each}})){{/if}} " +
                        "    GROUP BY id" +
                        ") " +
                        "SELECT e.*, " +
                        "    (SELECT json_group_array(token) FROM " +
                        "        (SELECT token FROM {{tableName}}_authtokens " +
                        "         WHERE envelope_id = e.id AND envelope_created_at = e.created_at " +
                        "         ORDER BY token_order)) AS authorized_tokens " +
                        "FROM {{tableName}} e " +
                        "JOIN latest_versions lv ON e.id = lv.id AND e.created_at = lv.max_created_at " +
                        "WHERE e.deleted = 0;"
        );

        // Compile all templates
        Map<String, Template> templateMap = modifyValues(templateStrings, (v) -> rethrow(() -> this.handlebars.compileInline(v)));

        return new RequiredTemplates(
                map(createScripts, (s) -> rethrow(() -> this.handlebars.compileInline(s))),
                templateMap.get("insert"),
                templateMap.get("insertToken"),
                templateMap.get("read"),
                templateMap.get("readMany"),
                templateMap.get("remove"),
                templateMap.get("removeMany"),
                templateMap.get("list")
        );
    }

    // Override methods that need SQLite-specific handling
    @Override
    public Optional<Envelope> read(String id, List<String> tokens, Instant createdAt) {
        if (createdAt == null) {
            createdAt = Instant.now();
        }

        try {
            Map<String, Object> context = new HashMap<>();
            context.put("tableName", tableName);
            context.put("hasTokens", tokens != null && !tokens.isEmpty());
            if (tokens != null && !tokens.isEmpty()) {
                context.put("tokens", tokens);
            }

            String sql = sqlTemplates.read().apply(context);

            try (Connection conn = dataSource.getConnection();
                 PreparedStatement stmt = conn.prepareStatement(sql)) {

                stmt.setString(1, id);
                // Convert Instant to millis for SQLite
                stmt.setLong(2, instantToMillis(createdAt));

                // Set token parameters if needed
                if (tokens != null && !tokens.isEmpty()) {
                    for (int i = 0; i < tokens.size(); i++) {
                        stmt.setString(i + 3, tokens.get(i));
                    }
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

    /**
     * Creates a document with retry logic for handling unique constraint
     * violations.
     *
     * @param envelope   Envelope to create
     * @param tokens     Authorization tokens
     * @return Created envelope
     */
    @Override
    public Envelope create(Envelope envelope, List<String> tokens) {
        String id = envelope.id() != null ? envelope.id() : UUID.randomUUID().toString();

        try {
            Map<String, Object> context = new HashMap<>();
            context.put("tableName", tableName);

            String sql = sqlTemplates.insert().apply(context);
            String tokenSql = sqlTemplates.insertToken().apply(context);

            Connection conn = null;
            try {
                conn = dataSource.getConnection();
                conn.setAutoCommit(false);

                // Insert main record
                try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                    stmt.setString(1, id);
                    stmt.setString(2, envelope.payload().toJSONString());

                    ResultSet rs = stmt.executeQuery();
                    if (!rs.next()) {
                        throw new SQLException("Failed to create document, no rows returned");
                    }

                    Envelope result = resultSetToEnvelope(rs);
                    rs.close();

                    // Insert token records if any
                    if (tokens != null && !tokens.isEmpty()) {
                        try (PreparedStatement tokenStmt = conn.prepareStatement(tokenSql)) {
                            for (int i = 0; i < tokens.size(); i++) {
                                tokenStmt.setString(1, id);
                                tokenStmt.setLong(2, instantToMillis(result.createdAt()));
                                tokenStmt.setString(3, tokens.get(i));
                                tokenStmt.setInt(4, i);
                                tokenStmt.addBatch();
                            }
                            tokenStmt.executeBatch();
                        }
                    }

                    conn.commit();
                    
                    // Set the authorized tokens on the result
                    return new Envelope(
                        result.id(),
                        result.payload(),
                        result.createdAt(),
                        result.deleted(),
                        tokens != null ? tokens : List.of()
                    );
                }
            } catch (SQLException e) {
                if (conn != null) {
                    try {
                        conn.rollback();
                    } catch (SQLException rollbackException) {
                        logger.error("Failed to rollback transaction", rollbackException);
                    }
                }
                // SQLite constraint violation error code is 19
                if (e.getErrorCode() == 19 && e.getMessage().contains("UNIQUE constraint failed")) {
                    try {
                        TimeUnit.MILLISECONDS.sleep(RETRY_DELAY_MS);
                        return create(envelope, tokens);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new RuntimeException("Interrupted during retry", ie);
                    }
                }
                throw e;
            } finally {
                if (conn != null) {
                    try {
                        conn.setAutoCommit(true);
                        conn.close();
                    } catch (SQLException closeException) {
                        logger.error("Failed to close connection", closeException);
                    }
                }
            }
        } catch (SQLException e) {
            logger.error("Error creating document: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to create document", e);
        } catch (IOException e) {
            logger.error("Failed to render SQL template", e);
            throw new RuntimeException("Failed to render SQL template", e);
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
            if (tokens != null && !tokens.isEmpty()) {
                context.put("tokens", tokens);
            }
            context.put("ids", ids);

            String sql = sqlTemplates.readMany().apply(context);

            try (Connection conn = dataSource.getConnection();
                 PreparedStatement stmt = conn.prepareStatement(sql)) {

                // Set ID parameters
                for (int i = 0; i < ids.size(); i++) {
                    stmt.setString(i + 1, ids.get(i));
                }

                // Set token parameters if needed
                if (tokens != null && !tokens.isEmpty()) {
                    int startIndex = ids.size() + 1;
                    for (int i = 0; i < tokens.size(); i++) {
                        stmt.setString(startIndex + i, tokens.get(i));
                    }
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
            if (tokens != null && !tokens.isEmpty()) {
                context.put("tokens", tokens);
            }

            String sql = sqlTemplates.remove().apply(context);

            try (Connection conn = dataSource.getConnection();
                 PreparedStatement stmt = conn.prepareStatement(sql)) {

                stmt.setString(1, id);

                // Set token parameters if needed
                if (tokens != null && !tokens.isEmpty()) {
                    for (int i = 0; i < tokens.size(); i++) {
                        stmt.setString(i + 2, tokens.get(i));
                    }
                }

                int changedRows = stmt.executeUpdate();
                return changedRows > 0;
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
            if (tokens != null && !tokens.isEmpty()) {
                context.put("tokens", tokens);
            }
            context.put("ids", ids);

            String sql = sqlTemplates.removeMany().apply(context);

            try (Connection conn = dataSource.getConnection();
                 PreparedStatement stmt = conn.prepareStatement(sql)) {

                // Set ID parameters
                for (int i = 0; i < ids.size(); i++) {
                    stmt.setString(i + 1, ids.get(i));
                }

                // Set token parameters if needed
                if (tokens != null && !tokens.isEmpty()) {
                    int startIndex = ids.size() + 1;
                    for (int i = 0; i < tokens.size(); i++) {
                        stmt.setString(startIndex + i, tokens.get(i));
                    }
                }

                int changedRows = stmt.executeUpdate();

                // Return all IDs as successfully removed if any rows were changed
                Map<String, Boolean> result = new HashMap<>();
                for (String id : ids) {
                    result.put(id, changedRows > 0);
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
            if (tokens != null && !tokens.isEmpty()) {
                context.put("tokens", tokens);
            }

            String sql = sqlTemplates.list().apply(context);

            try (Connection conn = dataSource.getConnection();
                 PreparedStatement stmt = conn.prepareStatement(sql)) {

                // Set token parameters if needed
                if (tokens != null && !tokens.isEmpty()) {
                    for (int i = 0; i < tokens.size(); i++) {
                        stmt.setString(i + 1, tokens.get(i));
                    }
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