package com.meshql.api.graphql;

import graphql.language.*;
import graphql.util.TraversalControl;
import graphql.util.TraverserContext;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.List;

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
            boolean hasAtArgument = node.getArguments().stream()
                    .anyMatch(arg -> arg.getName().equals("at"));

            if (!hasAtArgument) {
                Argument atArgument = new Argument("at", new IntValue(BigInteger.valueOf(timestamp)));
                List<Argument> newArguments = new ArrayList<>(node.getArguments());
                newArguments.add(atArgument);

                Field newNode = node.transform(builder -> builder.arguments(newArguments));
                context.changeNode(newNode);
                System.out.println(AstPrinter.printAst(newNode));
                context.setAccumulate(newNode);
                return TraversalControl.CONTINUE;
            }
        }
        return TraversalControl.CONTINUE;
    }
}
