package com.meshql.repositories.sqlite;

import com.github.jknack.handlebars.Handlebars;
import com.github.jknack.handlebars.Template;
import com.meshql.auth.noop.NoAuth;
import com.meshql.core.Auth;
import com.meshql.repos.certification.SearcherCertification;
import org.junit.jupiter.api.AfterAll;

import org.sqlite.SQLiteDataSource;


import javax.sql.DataSource;
import java.io.IOException;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;


public class SQLiteSearcherTest extends SearcherCertification {

    private final static  List<DataSource> dataSources = new ArrayList<>();
    private int testCounter = 0;
    private final Handlebars handlebars = new Handlebars();

    @Override
    public void init() {
        try {

            SQLiteDataSource dataSource= new SQLiteDataSource();
            dataSource.setUrl("jdbc:sqlite::memory:");
            dataSources.add(dataSource);

            // Create a unique table name for each test
            String tableName = "test" + (++testCounter);

            // Create and initialize the repository
            SQLiteRepository sqLiteRepository = new SQLiteRepository(dataSource, tableName);
            sqLiteRepository.initialize();
            repository = sqLiteRepository;

            // Create the searcher with NoAuth
            Auth noAuth = new NoAuth();
            searcher = new SQLiteSearcher(dataSource, tableName, noAuth);

            // Create the templates
            templates = createTemplates();

        } catch (SQLException | IOException e) {
            throw new RuntimeException("Failed to initialize PostgreSQL searcher test", e);
        }
    }

    private SearcherTemplates createTemplates() throws IOException {
        Template findById = handlebars.compileInline("id = '{{id}}'");
        Template findByName = handlebars.compileInline("payload->>'name' = '{{id}}'");
        Template findAllByType = handlebars
                .compileInline("payload->>'type' = '{{id}}'");
        Template findByNameAndType = handlebars.compileInline(
                "payload->>'type' = '{{type}}' AND payload->>'name' = '{{name}}'");

        return new SearcherTemplates(findById, findByName, findAllByType, findByNameAndType);
    }

    @AfterAll
    public static void tearDown() {
        // Close all data sources
        for (DataSource dataSource : dataSources) {
            if (dataSource instanceof AutoCloseable) {
                try {
                    ((AutoCloseable) dataSource).close();
                } catch (Exception e) {
                    // Log but continue closing other resources
                    System.err.println("Error closing data source: " + e.getMessage());
                }
            }
        }
    }
}