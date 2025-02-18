package com.meshql.api.graphql;

import graphql.language.*;
import graphql.util.TraversalControl;
import graphql.util.TraverserContext;

import java.math.BigInteger;
import java.util.ArrayList;

public class QueryVisitor extends NodeVisitorStub {
    private final String queryName;
    private final long timestamp;

    public QueryVisitor(String queryName, long timestamp) {
        this.queryName = queryName;
        this.timestamp = timestamp;
    }

    @Override
    public TraversalControl visitField(Field node, TraverserContext<Node> context) {
        if (node.getName().equals(queryName)) {
            var hasAtArgument = node.getArguments().stream()
                    .anyMatch(arg -> arg.getName().equals("at"));

            if (!hasAtArgument) {
                var atArgument = new Argument(
                    "at",
                    new IntValue(BigInteger.valueOf(timestamp))
                );
                var newArguments = new ArrayList<>(node.getArguments());
                newArguments.add(atArgument);
                return TraversalControl.REPLACE(node.transform(builder -> 
                    builder.arguments(newArguments)));
            }
        }
        return TraversalControl.CONTINUE;
    }
} 