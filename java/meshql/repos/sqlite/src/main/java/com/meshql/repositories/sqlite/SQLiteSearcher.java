package com.meshql.repositories.sqlite;

import com.meshql.core.Auth;
import com.meshql.repositories.rdbms.RDBMSSearcher;

import javax.sql.DataSource;

public class SQLiteSearcher extends RDBMSSearcher {
    private static final String SINGLETON_QUERY_TEMPLATE = "SELECT e.*, " +
            "    (SELECT json_group_array(token) FROM " +
            "        (SELECT token FROM %s_authtokens " +
            "         WHERE envelope_id = e.id AND envelope_created_at = e.created_at " +
            "         ORDER BY token_order)) AS authorized_tokens " +
            "FROM %s e " +
            "WHERE %s " +
            "  AND e.created_at <= ? " +
            "  AND e.deleted = 0 " +
            "ORDER BY e.created_at DESC " +
            "LIMIT 1";

    /**
     * SQL template for finding multiple records.
     */
    private static final String VECTOR_QUERY_TEMPLATE = "WITH latest_versions AS (" +
            "    SELECT DISTINCT id, MAX(created_at) AS max_created_at " +
            "    FROM %s " +
            "    WHERE %s " +
            "      AND created_at <= ? " +
            "      AND deleted = 0 " +
            "    GROUP BY id" +
            ") " +
            "SELECT e.*, " +
            "    (SELECT json_group_array(token) FROM " +
            "        (SELECT token FROM %s_authtokens " +
            "         WHERE envelope_id = e.id AND envelope_created_at = e.created_at " +
            "         ORDER BY token_order)) AS authorized_tokens " +
            "FROM %s e " +
            "JOIN latest_versions lv ON e.id = lv.id AND e.created_at = lv.max_created_at " +
            "WHERE e.deleted = 0";

    public SQLiteSearcher(DataSource dataSource, String tableName, Auth authorizer) {
        super(SINGLETON_QUERY_TEMPLATE, VECTOR_QUERY_TEMPLATE, dataSource, tableName, authorizer);
    }
} 