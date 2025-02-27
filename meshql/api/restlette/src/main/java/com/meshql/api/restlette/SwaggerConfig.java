package com.meshql.api.restlette;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.PathItem;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.responses.ApiResponses;
import io.swagger.v3.oas.models.security.SecurityScheme;

import java.util.Map;

public class SwaggerConfig {

    @SuppressWarnings("unchecked")
    public static void configureSwagger(OpenAPI openAPI, Map<String, Object> jsonSchema) {
        Components components = new Components();

        // Add security scheme
        components.addSecuritySchemes("BearerAuth",
                new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT"));

        // Add schemas
        components.addSchemas("State", createSchemaFromJsonSchema(jsonSchema));

        // Add operation status schema
        components.addSchemas("OperationStatus", new Schema<>()
                .type("object")
                .addProperty("id", new Schema<>().type("string"))
                .addProperty("status", new Schema<>().type("string"))
                .addProperty("error", new Schema<>().type("string")));

        // Configure paths
        configurePaths(openAPI);

        openAPI.components(components);
    }

    private static void configurePaths(OpenAPI openAPI) {
        // Create paths for CRUD operations
        PathItem getPath = new io.swagger.v3.oas.models.PathItem()
                .get(new io.swagger.v3.oas.models.Operation()
                        .summary("Get all items")
                        .responses(new ApiResponses()
                                .addApiResponse("200", new ApiResponse()
                                        .description("Successful operation")
                                        .content(new Content().addMediaType("application/json",
                                                new MediaType()
                                                        .schema(new Schema<>().$ref("#/components/schemas/State")))))));

        // Add other paths and operations
        // (Simplified for brevity - would need to add all CRUD operations)

        openAPI.path("/", getPath);
    }

    @SuppressWarnings("unchecked")
    private static Schema<?> createSchemaFromJsonSchema(Map<String, Object> jsonSchema) {
        Schema<?> schema = new Schema<>();

        if (jsonSchema.containsKey("type")) {
            schema.type((String) jsonSchema.get("type"));
        }

        if (jsonSchema.containsKey("properties") && jsonSchema.get("properties") instanceof Map) {
            Map<String, Object> properties = (Map<String, Object>) jsonSchema.get("properties");

            for (Map.Entry<String, Object> entry : properties.entrySet()) {
                if (entry.getValue() instanceof Map) {
                    Map<String, Object> propertySchema = (Map<String, Object>) entry.getValue();
                    Schema<?> propertySchemaObj = createSchemaFromJsonSchema(propertySchema);
                    schema.addProperty(entry.getKey(), propertySchemaObj);
                }
            }
        }

        return schema;
    }
}