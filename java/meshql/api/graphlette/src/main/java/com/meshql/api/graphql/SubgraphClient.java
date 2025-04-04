package com.meshql.api.graphql;

import com.tailoredshapes.stash.Stash;
import com.tailoredshapes.underbar.ocho.Die;
import graphql.language.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

import static com.tailoredshapes.stash.Stash.stash;
import static com.tailoredshapes.underbar.ocho.Die.rethrow;
import static com.tailoredshapes.underbar.ocho.UnderBar.list;
import static com.tailoredshapes.underbar.ocho.UnderBar.map;

public interface SubgraphClient {
    Logger logger = LoggerFactory.getLogger(SubgraphClient.class);

    static Object fetch(
            URI uri,
            String query,
            String queryName,
            String authHeader
    ) {
        try(var httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build()) {
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

            var request = builder.build();
            return rethrow(() -> {
                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

                Die.dieIf(response.statusCode() != 200, () -> "HTTP error: " + response.statusCode());
                Stash result = Die.rethrow(() -> Stash.parseJSON(response.body()));
                Die.dieIf(result.containsKey("errors"), () -> "Subgraph returned: " + result.get("errors"));

                var data = result.asStash("data");
                return data != null ? data.get(queryName) : stash();
            });
        }
    }

    static String processSelectionSet(SelectionSet selectionSet) {
        return selectionSet.getSelections().stream()
                .filter(Field.class::isInstance)
                .map(Field.class::cast)
                .map(SubgraphClient::processFieldNode)
                .reduce("", String::concat);
    }

    static String processFieldNode(Field field) {
        var name = field.getName();
        if (field.getSelectionSet() != null) {
            return String.format("%s {\n%s}\n", name, processSelectionSet(field.getSelectionSet()));
        }
        return name + "\n";
    }

    static String processContext(
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
        return String.format("{%s(id: \"%s\" at: %d){\n%s}}", queryName, id, timestamp, selections);
    }
}
