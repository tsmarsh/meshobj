package com.meshql.hello;

public class HelloWorld {
    public String getMessage() {
        return "Hello, MeshQL!";
    }

    public static void main(String[] args) {
        HelloWorld hello = new HelloWorld();
        System.out.println(hello.getMessage());
    }
} 