package com.meshql.api.graphql;

import com.tailoredshapes.stash.Stash;
import graphql.language.*;
import graphql.parser.Parser;
import graphql.schema.GraphQLSchema;
import graphql.language.AstPrinter;
import graphql.language.AstTransformer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

public class SubgraphClient {
    private static final Logger logger = LoggerFactory.getLogger(SubgraphClient.class);
    private final HttpClient httpClient;

    public SubgraphClient() {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    public CompletableFuture<Map<String, Object>> callSubgraph(
            URI uri,
            String query,
            String queryName,
            String authHeader
    ) {
        var request = createRequest(uri, query, authHeader);
        return httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                .thenApply(this::handleResponse)
                .thenApply(json -> extractData(json, queryName));
    }

    private HttpRequest createRequest(URI uri, String query, String authHeader) {
        var builder = HttpRequest.newBuilder()
                .uri(uri)
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(
                        String.format("{\"query\": \"%s\"}", query.replace("\"", "\\\""))
                ));

        if (authHeader != null && !authHeader.isEmpty()) {
            builder.header("Authorization", authHeader);
        }

        return builder.build();
    }

    @SuppressWarnings("unchecked")
    private Stash handleResponse(HttpResponse<String> response) {
        try {
            if (response.statusCode() != 200) {
                throw new SubgraphException("HTTP error: " + response.statusCode());
            }
            return Stash.parseJSON(response.body());
        } catch (Exception e) {
            logger.error("Error parsing response: {}", response.body(), e);
            throw new SubgraphException("Failed to parse response", e);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> extractData(Map<String, Object> json, String queryName) {
        if (json.containsKey("errors")) {
            var errors = (List<Map<String, Object>>) json.get("errors");
            throw new SubgraphException(errors.get(0).get("message").toString());
        }
        var data = (Map<String, Object>) json.get("data");
        return data != null ? (Map<String, Object>) data.get(queryName) : Map.of();
    }

    public static String processSelectionSet(SelectionSet selectionSet) {
        return selectionSet.getSelections().stream()
                .filter(Field.class::isInstance)
                .map(Field.class::cast)
                .map(SubgraphClient::processFieldNode)
                .reduce("", String::concat);
    }

    public static String processFieldNode(Field field) {
        var name = field.getName();
        if (field.getSelectionSet() != null) {
            return String.format("%s {\n%s}\n", name, processSelectionSet(field.getSelectionSet()));
        }
        return name + "\n";
    }

    public static String addTimestampToQuery(
            String query,
            GraphQLSchema schema,
            String queryName,
            long timestamp
    ) {
        var document = Parser.parse(query);

        var visitor = new QueryVisitor(queryName, timestamp);
        document = (Document) new AstTransformer().transform(document, visitor);

        return AstPrinter.printAst(document);
    }

    public static String processContext(
            String id,
            Map<String, Object> context,
            String queryName,
            long timestamp
    ) {
        // Validate that fieldNodes exist
        if (!context.containsKey("fieldNodes") || !(context.get("fieldNodes") instanceof List<?> fieldNodesRaw)) {
            throw new SubgraphException("Context is malformed: missing fieldNodes");
        }

        @SuppressWarnings("unchecked")
        List<Field> fieldNodes = (List<Field>) fieldNodesRaw;
        if (fieldNodes.isEmpty()) {
            throw new SubgraphException("Context is malformed: empty fieldNodes");
        }

        var firstNode = fieldNodes.get(0);
        if (firstNode.getSelectionSet() == null) {
            throw new SubgraphException("Context is malformed: first field has no selectionSet");
        }

        var selections = processSelectionSet(firstNode.getSelectionSet());
        var query = String.format("{%s(id: \"%s\"){\n%s}}", queryName, id, selections);
        return addTimestampToQuery(query, (GraphQLSchema) context.get("schema"), queryName, timestamp);
    }
}
