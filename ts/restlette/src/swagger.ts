export const paths = (context: string) => {
    return {
        [`${context}`]: {
            get: {
                operationId: 'list',
                summary: 'Lists all documents',
                security: [
                    {
                        BearerAuth: [],
                    },
                ],
                responses: {
                    200: {
                        description: 'A list of documents',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'array',
                                    items: {
                                        type: 'string',
                                    },
                                },
                            },
                        },
                    },
                },
            },
            post: {
                operationId: 'create',
                summary: 'Creates a document',
                security: [
                    {
                        BearerAuth: [],
                    },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/State',
                            },
                        },
                    },
                },
                responses: {
                    303: {
                        description: 'The document was successfully created. You’ll be redirected to its URL.',
                    },
                    404: {
                        description: 'A document with the specified ID was not found.',
                    },
                },
            },
        },
        [`${context}/{id}`]: {
            get: {
                summary: 'Retrieves a document',
                operationId: 'read',
                security: [
                    {
                        BearerAuth: [],
                    },
                ],
                parameters: [
                    {
                        in: 'path',
                        name: 'id',
                        required: true,
                        schema: {
                            type: 'string',
                        },
                        description: 'The ID of the document to retrieve.',
                    },
                ],
                responses: {
                    200: {
                        description: 'The document was successfully retrieved.',
                        headers: {
                            'X-Canonical-Id': {
                                schema: {
                                    type: 'string',
                                },
                            },
                        },
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/State',
                                },
                            },
                        },
                    },
                    404: {
                        description: 'A document with the specified ID was not found.',
                    },
                },
            },
            put: {
                summary: 'Creates or updates a document',
                operationId: 'update',
                security: [
                    {
                        BearerAuth: [],
                    },
                ],
                parameters: [
                    {
                        in: 'path',
                        name: 'id',
                        required: true,
                        schema: {
                            type: 'string',
                        },
                        description: 'The ID of the document to create or update.',
                    },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/State',
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'The document was successfully updated.',
                    },
                    201: {
                        description: 'The document was successfully created.',
                        headers: {
                            Location: {
                                schema: {
                                    type: 'string',
                                },
                                description: 'URI of the created document.',
                            },
                        },
                    },
                },
            },
            delete: {
                summary: 'Deletes a document',
                operationId: 'delete',
                security: [
                    {
                        BearerAuth: [],
                    },
                ],
                parameters: [
                    {
                        in: 'path',
                        name: 'id',
                        required: true,
                        schema: {
                            type: 'string',
                        },
                        description: 'The ID of the document to delete.',
                    },
                ],
                responses: {
                    200: {
                        description: 'The document was successfully deleted.',
                    },
                    404: {
                        description: 'A document with the specified ID was not found.',
                    },
                },
            },
        },
        [`${context}/bulk`]: {
            get: {
                summary: 'Retrieves all documents in bulk',
                operationId: 'bulk_read',
                security: [
                    {
                        BearerAuth: [],
                    },
                ],
                responses: {
                    200: {
                        description: 'The documents were successfully retrieved.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'array',
                                    items: {
                                        $ref: '#/components/schemas/State',
                                    },
                                },
                            },
                        },
                    },
                },
            },
            post: {
                summary: 'Creates multiple documents',
                operationId: 'bulk_create',
                security: [
                    {
                        BearerAuth: [],
                    },
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'array',
                                items: {
                                    $ref: '#/components/schemas/State',
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'The documents were successfully created.',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        successful: {
                                            type: 'array',
                                            items: {
                                                $ref: '#/components/schemas/OperationStatus',
                                            },
                                        },
                                        failed: {
                                            type: 'array',
                                            items: {
                                                $ref: '#/components/schemas/OperationStatus',
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    };
};
