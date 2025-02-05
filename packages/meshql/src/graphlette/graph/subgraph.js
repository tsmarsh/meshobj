import Log4js from 'log4js';
import { parse, print, TypeInfo, visit, visitWithTypeInfo, } from 'graphql';
let logger = Log4js.getLogger('meshql/subgraph');
async function callSibling(query, url, authHeader) {
    const body = JSON.stringify({ query: query }, null, 2);
    logger.trace('Subgraph Call: ', url.pathname, JSON.stringify(query, null, 2));
    let headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
    };
    if (authHeader !== null) {
        headers.Authorization = authHeader;
    }
    let response = await fetch(url.toString(), {
        method: 'POST',
        headers,
        body,
    }).catch((err) => {
        logger.error(err);
    });
    return response;
}
async function processResponse(response, queryName) {
    if (response instanceof Response) {
        const text = await response.text();
        let json;
        try {
            json = JSON.parse(text);
        }
        catch (err) {
            logger.error(`This isn't json: ${text}`);
            logger.error(`Error parsing json from response: ${err}`);
            json = { errors: [{ message: text }] };
        }
        if (Object.hasOwnProperty.call(json, 'errors')) {
            logger.error(json);
            throw new Error(json['errors'][0]['message']);
        }
        return json['data'][queryName];
    }
    return {};
}
export const callSubgraph = async (url, query, queryName, authHeader) => {
    let response = await callSibling(query, url, authHeader);
    return await processResponse(response, queryName);
};
export const processSelectionSet = (selectionSet) => {
    return selectionSet.selections
        .filter((n) => n.kind === 'Field')
        .reduce((previousValue, field) => previousValue + processFieldNode(field), '');
};
export const processFieldNode = (field) => {
    if (field.selectionSet !== undefined) {
        return `${field.name.value} {
                ${processSelectionSet(field.selectionSet)}
            }\n`;
    }
    else {
        return field.name.value + '\n';
    }
};
export const addTimestampToQuery = (query, schema, queryName, timestamp) => {
    let ast = parse(query);
    const typeInfo = new TypeInfo(schema);
    ast = visit(ast, visitWithTypeInfo(typeInfo, {
        Field(node) {
            if (node.name.value === queryName) {
                if (!node.arguments?.some((arg) => arg.name.value === 'at')) {
                    return {
                        ...node,
                        arguments: node.arguments
                            ? [
                                ...node.arguments,
                                {
                                    kind: 'Argument',
                                    name: { kind: 'Name', value: 'at' },
                                    value: { kind: 'IntValue', value: timestamp.toString() },
                                },
                            ]
                            : [
                                {
                                    kind: 'Argument',
                                    name: { kind: 'Name', value: 'at' },
                                    value: { kind: 'IntValue', value: timestamp.toString() },
                                },
                            ],
                    };
                }
            }
        },
    }));
    return print(ast);
};
export const processContext = (id, context, queryName, timestamp) => {
    if (context.fieldNodes.length > 0) {
        const firstNode = context.fieldNodes[0];
        if (firstNode.selectionSet !== undefined) {
            const selectionSet = firstNode.selectionSet;
            const sss = processSelectionSet(selectionSet);
            let query = `{${queryName}(id: "${id}"){
                ${sss} 
               }}`;
            return addTimestampToQuery(query, context.schema, queryName, timestamp);
        }
    }
    throw Error('Context is malformed');
};
