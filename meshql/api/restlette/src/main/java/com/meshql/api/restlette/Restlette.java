package com.meshql.api.restlette;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.meshql.core.Auth;
import com.meshql.core.Repository;
import com.meshql.core.Validator;
import com.tailoredshapes.stash.Stash;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.servers.Server;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import spark.Service;

import java.util.Collections;
import java.util.List;
import java.util.Map;

public class Restlette {
    private static final Logger logger = LoggerFactory.getLogger(Restlette.class);
    private static final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Initialize a Restlette with the given configuration
     * 
     * @param sparkService The Spark service to use
     * @param crud         The CRUD handler
     * @param apiPath      The API path
     * @param port         The port to run on
     * @param jsonSchema   The JSON schema
     * @return The configured Spark service
     */
    public static Service init(
            Service sparkService,
            CrudHandler crud,
            String apiPath,
            int port,
            Stash jsonSchema) {
        logger.info("API Docs are available at: http://localhost:{}{}api-docs", port, apiPath);

        sparkService.before(apiPath + "/*", (req, res) -> {
            res.type("application/json");
        });

        // Setup CORS
        sparkService.options("/*", (request, response) -> {
            String accessControlRequestHeaders = request.headers("Access-Control-Request-Headers");
            if (accessControlRequestHeaders != null) {
                response.header("Access-Control-Allow-Headers", accessControlRequestHeaders);
            }

            String accessControlRequestMethod = request.headers("Access-Control-Request-Method");
            if (accessControlRequestMethod != null) {
                response.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
            }

            return "OK";
        });

        sparkService.before((request, response) -> {
            response.header("Access-Control-Allow-Origin", "*");
            response.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
            response.header("Access-Control-Allow-Headers", "Content-Type,Authorization");
        });

        // Setup routes
        sparkService.post(apiPath + "/bulk", crud::bulkCreate);
        sparkService.get(apiPath + "/bulk", crud::bulkRead);
        sparkService.post(apiPath, crud::create);
        sparkService.get(apiPath, crud::list);
        sparkService.get(apiPath + "/:id", crud::read);
        sparkService.put(apiPath + "/:id", crud::update);
        sparkService.delete(apiPath + "/:id", crud::remove);

        // Setup Swagger documentation
        OpenAPI openAPI = createSwaggerDocument(apiPath, port, jsonSchema);
        String swaggerJson = serializeSwaggerDocument(openAPI);

        sparkService.get(apiPath + "/api-docs/swagger.json", (req, res) -> swaggerJson);
        sparkService.get(apiPath + "/api-docs", new SwaggerUIHandler(apiPath));

        return sparkService;
    }

    /**
     * Create a JSON Schema validator
     */
    public static Validator createJSONSchemaValidator(Stash schema) {
        return new JSONSchemaValidator(schema);
    }

    /**
     * Create the Swagger document
     */
    private static OpenAPI createSwaggerDocument(String apiPath, int port, Map<String, Object> schema) {
        OpenAPI openAPI = new OpenAPI();

        Info info = new Info()
                .title(apiPath + " API")
                .version("0.1.0")
                .description("API for mutating " + apiPath);

        openAPI.setInfo(info);

        Server server = new Server();
        server.setUrl("http://localhost:" + port);
        openAPI.setServers(Collections.singletonList(server));

        // Add security schemes and schemas
        SwaggerConfig.configureSwagger(openAPI, schema);

        return openAPI;
    }

    /**
     * Serialize the Swagger document to JSON
     */
    private static String serializeSwaggerDocument(OpenAPI openAPI) {
        try {
            return objectMapper.writeValueAsString(openAPI);
        } catch (Exception e) {
            logger.error("Failed to serialize Swagger document", e);
            return "{}";
        }
    }
}