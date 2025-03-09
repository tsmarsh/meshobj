package com.meshql.api.restlette;

import com.tailoredshapes.stash.Stash;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.media.Schema;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static com.tailoredshapes.stash.Stash.stash;
import static org.junit.jupiter.api.Assertions.*;

class SwaggerConfigTest {

    @Test
    void testConfigureSwagger() {
        // Arrange
        OpenAPI openAPI = new OpenAPI();
        Stash jsonSchema= stash(
                "type", "object",
                "properties", stash(
                        "name", stash("type", "string"),
                        "value", stash("type", "integer")));

        // Act
        SwaggerConfig.configureSwagger(openAPI, jsonSchema);

        // Assert
        Components components = openAPI.getComponents();
        assertNotNull(components);
        assertNotNull(components.getSecuritySchemes());
        assertTrue(components.getSecuritySchemes().containsKey("BearerAuth"));

        // Check for schemas
        Map<String, Schema> schemas = components.getSchemas();
        assertNotNull(schemas);
        assertTrue(schemas.containsKey("State"));
        assertTrue(schemas.containsKey("OperationStatus"));

        // Verify schema properties
        Schema stateSchema = schemas.get("State");
        assertEquals("object", stateSchema.getType());
        assertTrue(stateSchema.getProperties().containsKey("name"));
        assertTrue(stateSchema.getProperties().containsKey("value"));
    }

    @Test
    void testCreateSchemaFromJsonSchema() {
        // Arrange
        Map<String, Object> nestedSchema = Map.of(
                "type", "object",
                "properties", Map.of(
                        "user", Map.of(
                                "type", "object",
                                "properties", Map.of(
                                        "firstName", Map.of("type", "string"),
                                        "lastName", Map.of("type", "string"),
                                        "age", Map.of("type", "integer"))),
                        "items", Map.of(
                                "type", "array",
                                "items", Map.of("type", "string"))));

        // Create a test method to access the private method
        class TestHelper {
            public Schema<?> testCreateSchema(Map<String, Object> schema) {
                java.lang.reflect.Method method;
                try {
                    method = SwaggerConfig.class.getDeclaredMethod("createSchemaFromJsonSchema", Map.class);
                    method.setAccessible(true);
                    return (Schema<?>) method.invoke(null, schema);
                } catch (Exception e) {
                    fail("Reflection failed: " + e.getMessage());
                    return null;
                }
            }
        }

        // Act
        Schema<?> schema = new TestHelper().testCreateSchema(nestedSchema);

        // Assert
        assertNotNull(schema);
        assertEquals("object", schema.getType());

        Map<String, Schema> properties = schema.getProperties();
        assertTrue(properties.containsKey("user"));
        assertTrue(properties.containsKey("items"));

        Schema userSchema = properties.get("user");
        assertEquals("object", userSchema.getType());
        assertTrue(userSchema.getProperties().containsKey("firstName"));
        assertTrue(userSchema.getProperties().containsKey("lastName"));
        assertTrue(userSchema.getProperties().containsKey("age"));
    }
}