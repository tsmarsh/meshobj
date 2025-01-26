package com.meshql.hello;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;

public class HelloWorldTest {
    @Test
    public void testGetMessage() {
        HelloWorld hello = new HelloWorld();
        assertEquals("Hello, MeshQL!", hello.getMessage());
    }
} 