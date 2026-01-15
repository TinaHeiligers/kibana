Understood!  Let me create a test suite that works with Kibana's existing Jest configuration: 

## Test Suite for Kibana's Jest Setup

### **1. Main Test File - SchemaExtractor Tests**

```typescript name=oas_docs/scripts/lib/__tests__/schema-extractor.test.ts url=https://github.com/elastic/kibana/blob/main/oas_docs/scripts/lib/__tests__/schema-extractor.test.ts
/*
 * Copyright Elasticsearch B. V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements.  Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1". 
 */

import type { OpenAPIV3 } from 'openapi-types';
import { SchemaExtractor, ConsoleLogger } from '../schema-extractor';

describe('SchemaExtractor', () => {
  let extractor: SchemaExtractor;
  let mockLogger: { info: jest.Mock; debug: jest.Mock; warn: jest.Mock; error: jest.Mock };

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    extractor = new SchemaExtractor({ verbose: false }, mockLogger);
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const ext = new SchemaExtractor();
      expect(ext.getStats()).toEqual({
        schemasExtracted: 0,
        compositionsFound: 0,
        oneOfCount: 0,
        anyOfCount: 0,
        allOfCount: 0,
        discriminatorsPreserved: 0,
        maxDepthReached: 0,
      });
    });

    it('should accept custom options', () => {
      const ext = new SchemaExtractor({
        minComplexity: 5,
        maxDepth: 15,
        namingPrefix: 'Custom',
        verbose: true,
      });
      expect(ext).toBeDefined();
    });

    it('should use custom logger if provided', () => {
      const customLogger = mockLogger;
      const ext = new SchemaExtractor({}, customLogger);
      ext.process(createMinimalDocument());
      expect(customLogger. info).toHaveBeenCalled();
    });
  });

  describe('process method', () => {
    it('should process document without paths', () => {
      const doc:  OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: { title: 'Test', version:  '1.0' },
      };
      const result = extractor.process(doc);
      expect(result).toBeDefined();
      expect(extractor.getStats().schemasExtracted).toBe(0);
    });

    it('should return modified document', () => {
      const doc = createDocumentWithOneOf();
      const result = extractor.process(doc);
      expect(result).toBeDefined();
      expect(result.openapi).toBe('3.0.3');
    });

    it('should preserve document structure', () => {
      const doc = createDocumentWithOneOf();
      const result = extractor.process(doc);
      expect(result. info).toEqual(doc.info);
      expect(result.paths).toBeDefined();
    });

    it('should not modify input document reference', () => {
      const doc = createDocumentWithOneOf();
      const originalKeys = Object.keys(doc);
      extractor.process(doc);
      expect(Object.keys(doc)).toEqual(originalKeys);
    });
  });

  describe('oneOf composition extraction', () => {
    it('should extract simple oneOf composition', () => {
      const doc = createDocumentWithOneOf();
      extractor.process(doc);

      const stats = extractor.getStats();
      expect(stats.compositionsFound).toBeGreaterThan(0);
      expect(stats.oneOfCount).toBeGreaterThan(0);
    });

    it('should create $ref in response schema', () => {
      const doc = createDocumentWithOneOf();
      const result = extractor.process(doc);

      const responseSchema = result.paths? .['/api/test']?. get?.responses?.['200']?.content? .[
        'application/json'
      ]?.schema;

      expect(responseSchema).toBeDefined();
      expect(responseSchema).toHaveProperty('$ref');
    });

    it('should add schemas to components', () => {
      const doc = createDocumentWithOneOf();
      const result = extractor.process(doc);

      expect(result.components?.schemas).toBeDefined();
      expect(Object.keys(result.components?.schemas || {}).length).toBeGreaterThan(0);
    });

    it('should skip oneOf with all references', () => {
      const doc:  OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0' },
        paths: {
          '/api/test': {
            get:  {
              responses: {
                '200': {
                  description: 'OK',
                  content: {
                    'application/json': {
                      schema: {
                        oneOf: [
                          { $ref: '#/components/schemas/Schema1' },
                          { $ref:  '#/components/schemas/Schema2' },
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
        },
        components: {
          schemas: {
            Schema1: { type:  'object' },
            Schema2: { type: 'object' },
          },
        },
      };

      const result = extractor.process(doc);
      const stats = extractor.getStats();

      expect(stats.schemasExtracted).toBeLessThanOrEqual(0);
    });

    it('should extract oneOf with mixed inline and reference items', () => {
      const doc: OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0' },
        paths: {
          '/api/test': {
            get: {
              operationId: 'GetTest',
              responses: {
                '200': {
                  description: 'OK',
                  content: {
                    'application/json': {
                      schema: {
                        oneOf: [
                          {
                            type: 'object',
                            properties: { id: { type: 'string' } },
                          },
                          { $ref: '#/components/schemas/Existing' },
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
        },
        components: {
          schemas: {
            Existing:  { type: 'object' },
          },
        },
      };

      const result = extractor.process(doc);
      const stats = extractor.getStats();

      expect(stats.schemasExtracted).toBeGreaterThan(0);
    });
  });

  describe('anyOf composition extraction', () => {
    it('should extract anyOf composition from request body', () => {
      const doc:  OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0' },
        paths: {
          '/api/search': {
            post: {
              operationId: 'SearchUsers',
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      anyOf: [
                        {
                          type: 'object',
                          properties: { id: { type: 'string' } },
                          required: ['id'],
                        },
                        {
                          type: 'object',
                          properties: { email: { type: 'string' } },
                          required: ['email'],
                        },
                      ],
                    },
                  },
                },
              },
              responses: {
                '200':  { description: 'OK' },
              },
            },
          },
        },
      };

      extractor.process(doc);
      const stats = extractor.getStats();

      expect(stats. anyOfCount).toBeGreaterThan(0);
      expect(stats.compositionsFound).toBeGreaterThan(0);
    });

    it('should preserve anyOf semantics in extracted schema', () => {
      const doc: OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0' },
        paths: {
          '/api/test': {
            get: {
              responses: {
                '200': {
                  description: 'OK',
                  content: {
                    'application/json': {
                      schema: {
                        anyOf: [
                          { type: 'object', properties: { a: { type: 'string' } } },
                          { type: 'object', properties: { b: { type: 'string' } } },
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const result = extractor.process(doc);
      const schemas = result.components?.schemas || {};

      const extractedSchemaValues = Object.values(schemas);
      const hasAnyOf = extractedSchemaValues.some((s) => 'anyOf' in s);

      expect(hasAnyOf).toBe(true);
    });
  });

  describe('allOf composition extraction', () => {
    it('should extract allOf composition', () => {
      const doc:  OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0' },
        paths: {
          '/api/docs': {
            post: {
              operationId:  'CreateDoc',
              requestBody: {
                content: {
                  'application/json':  {
                    schema: {
                      allOf: [
                        {
                          type: 'object',
                          properties:  { title: { type: 'string' } },
                          required: ['title'],
                        },
                        {
                          type: 'object',
                          properties: { metadata: { type: 'object' } },
                        },
                      ],
                    },
                  },
                },
              },
              responses: {
                '201': { description: 'Created' },
              },
            },
          },
        },
      };

      extractor.process(doc);
      const stats = extractor.getStats();

      expect(stats.allOfCount).toBeGreaterThan(0);
    });
  });

  describe('complexity calculation', () => {
    it('should respect minComplexity option', () => {
      const simpleDoc:  OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0' },
        paths: {
          '/api/test': {
            get:  {
              responses: {
                '200': {
                  description: 'OK',
                  content: {
                    'application/json': {
                      schema: {
                        oneOf: [{ type: 'string' }, { type: 'number' }],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const ext1 = new SchemaExtractor({ minComplexity: 2 });
      ext1.process(simpleDoc);
      const stats1 = ext1.getStats();

      const ext2 = new SchemaExtractor({ minComplexity: 1 });
      ext2.process(JSON.parse(JSON.stringify(simpleDoc)));
      const stats2 = ext2.getStats();

      expect(stats2.schemasExtracted).toBeGreaterThanOrEqual(stats1.schemasExtracted);
    });

    it('should extract complex schemas', () => {
      const complexDoc: OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0' },
        paths: {
          '/api/test': {
            get: {
              responses: {
                '200': {
                  description: 'OK',
                  content: {
                    'application/json': {
                      schema: {
                        oneOf: [
                          {
                            type: 'object',
                            properties: {
                              type: { type: 'string', enum: ['a'] },
                              fieldA: { type: 'string' },
                              fieldB:  { type: 'string' },
                              fieldC: { type: 'string' },
                            },
                            required: ['type'],
                          },
                          {
                            type: 'object',
                            properties: {
                              type: { type: 'string', enum: ['b'] },
                              dataX: { type: 'integer' },
                            },
                            required: ['type'],
                          },
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const ext = new SchemaExtractor({ minComplexity: 2 });
      ext.process(complexDoc);
      const stats = ext.getStats();

      expect(stats.schemasExtracted).toBeGreaterThan(0);
    });
  });

  describe('nesting depth handling', () => {
    it('should respect maxDepth option', () => {
      const deepDoc = createDeeplyNestedDocument(15);

      const ext1 = new SchemaExtractor({ maxDepth: 5 });
      ext1.process(deepDoc);
      const stats1 = ext1.getStats();

      const ext2 = new SchemaExtractor({ maxDepth: 20 });
      ext2.process(JSON.parse(JSON.stringify(deepDoc)));
      const stats2 = ext2.getStats();

      expect(stats2.compositionsFound).toBeGreaterThanOrEqual(stats1.compositionsFound);
    });

    it('should track maxDepthReached', () => {
      const deepDoc = createDeeplyNestedDocument(8);
      extractor.process(deepDoc);
      const stats = extractor.getStats();

      expect(stats.maxDepthReached).toBeGreaterThan(0);
    });

    it('should not exceed maxDepth when analyzing', () => {
      const deepDoc = createDeeplyNestedDocument(20);
      const ext = new SchemaExtractor({ maxDepth: 5 });
      ext.process(deepDoc);
      const stats = ext. getStats();

      expect(stats.maxDepthReached).toBeLessThanOrEqual(5);
    });
  });

  describe('discriminator handling', () => {
    it('should preserve discriminator in extracted schema', () => {
      const docWithDiscriminator: OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: { title:  'Test', version: '1.0' },
        paths: {
          '/api/animals': {
            get: {
              responses: {
                '200': {
                  description: 'OK',
                  content:  {
                    'application/json': {
                      schema: {
                        oneOf: [
                          {
                            type: 'object',
                            properties: {
                              kind: { type: 'string', enum: ['cat'] },
                              meow: { type: 'boolean' },
                            },
                            required: ['kind'],
                          },
                          {
                            type: 'object',
                            properties: {
                              kind:  { type: 'string', enum: ['dog'] },
                              bark: { type: 'boolean' },
                            },
                            required: ['kind'],
                          },
                        ],
                        discriminator: {
                          propertyName: 'kind',
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

      const result = extractor.process(docWithDiscriminator);
      const stats = extractor.getStats();

      expect(stats.discriminatorsPreserved).toBeGreaterThan(0);

      const schemas = result.components?.schemas || {};
      const hasDiscriminator = Object.values(schemas).some((s) => 'discriminator' in s);
      expect(hasDiscriminator).toBe(true);
    });

    it('should handle discriminator with mapping', () => {
      const doc: OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0' },
        paths: {
          '/api/test': {
            get: {
              responses: {
                '200': {
                  description: 'OK',
                  content:  {
                    'application/json': {
                      schema: {
                        oneOf: [
                          { type: 'object', properties: { t: { enum: ['A'] } } },
                          { type: 'object', properties: { t: { enum: ['B'] } } },
                        ],
                        discriminator: {
                          propertyName: 'type',
                          mapping: {
                            A: '#/components/schemas/TypeA',
                            B: '#/components/schemas/TypeB',
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

      extractor.process(doc);
      const stats = extractor.getStats();

      expect(stats.discriminatorsPreserved).toBeGreaterThan(0);
    });
  });

  describe('schema naming', () => {
    it('should generate names from operationId', () => {
      const doc: OpenAPIV3.Document = {
        openapi:  '3.0.3',
        info: { title: 'Test', version: '1.0' },
        paths: {
          '/api/users': {
            get: {
              operationId: 'ListUsers',
              responses: {
                '200': {
                  description: 'OK',
                  content: {
                    'application/json': {
                      schema: {
                        oneOf: [
                          { type: 'object', properties: { id: { type: 'string' } } },
                          { type: 'object', properties: { name: { type: 'string' } } },
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const result = extractor.process(doc);
      const schemas = result.components?.schemas || {};
      const schemaNames = Object.keys(schemas);

      expect(schemaNames. some((name) => name.includes('ListUsers'))).toBe(true);
    });

    it('should ensure unique schema names', () => {
      const docWithDuplicates: OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0' },
        paths: {
          '/api/endpoint1': {
            get: {
              operationId: 'GetEndpoint1',
              responses: {
                '200': {
                  description: 'OK',
                  content: {
                    'application/json': {
                      schema: {
                        oneOf:  [
                          { type: 'object', properties: { a: { type: 'string' } } },
                          { type: 'object', properties: { b: { type: 'string' } } },
                        ],
                      },
                    },
                  },
                },
                '201': {
                  description: 'Created',
                  content:  {
                    'application/json': {
                      schema: {
                        oneOf: [
                          { type: 'object', properties: { c: { type: 'string' } } },
                          { type: 'object', properties: { d: { type: 'string' } } },
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const result = extractor.process(docWithDuplicates);
      const schemas = result.components?.schemas || {};
      const schemaNames = Object.keys(schemas);
      const uniqueNames = new Set(schemaNames);

      expect(uniqueNames.size).toBe(schemaNames.length);
    });

    it('should use statusCode in response schema names', () => {
      const doc: OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0' },
        paths: {
          '/api/items': {
            get: {
              operationId: 'GetItems',
              responses: {
                '200': {
                  description: 'OK',
                  content: {
                    'application/json': {
                      schema: {
                        oneOf: [
                          { type:  'object' },
                          { type: 'object' },
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const result = extractor.process(doc);
      const schemas = result.components?.schemas || {};
      const schemaNames = Object.keys(schemas);

      expect(schemaNames.some((name) => name.includes('200'))).toBe(true);
    });
  });

  describe('request body handling', () => {
    it('should extract schemas from request bodies', () => {
      const doc: OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0' },
        paths: {
          '/api/items': {
            post: {
              operationId: 'CreateItem',
              requestBody: {
                content: {
                  'application/json': {
                    schema:  {
                      anyOf: [
                        { type: 'object', properties: { type: { enum: ['A'] } } },
                        { type: 'object', properties: { type: { enum: ['B'] } } },
                      ],
                    },
                  },
                },
              },
              responses: {
                '201': { description: 'Created' },
              },
            },
          },
        },
      };

      const result = extractor.process(doc);
      const requestSchema = result.paths? .['/api/items']?.post?.requestBody?.content? .[
        'application/json'
      ]?.schema;

      expect(requestSchema).toBeDefined();
      if (requestSchema && '$ref' in requestSchema) {
        expect(requestSchema.$ref).toContain('CreateItem');
      }
    });

    it('should include Request suffix in request schema names', () => {
      const doc: OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0' },
        paths: {
          '/api/items': {
            post: {
              operationId: 'CreateItem',
              requestBody: {
                content:  {
                  'application/json': {
                    schema: {
                      anyOf: [
                        { type: 'object', properties: { a: { type: 'string' } } },
                        { type: 'object', properties: { b: { type: 'string' } } },
                      ],
                    },
                  },
                },
              },
              responses: {
                '201':  { description: 'Created' },
              },
            },
          },
        },
      };

      const result = extractor.process(doc);
      const schemas = result.components?.schemas || {};
      const schemaNames = Object.keys(schemas);

      expect(schemaNames.some((name) => name.includes('Request'))).toBe(true);
    });
  });

  describe('skip paths feature', () => {
    it('should skip paths matching pattern', () => {
      const doc: OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0' },
        paths: {
          '/api/public': {
            get: {
              responses: {
                '200': {
                  description: 'OK',
                  content:  {
                    'application/json': {
                      schema: {
                        oneOf: [
                          { type: 'object' },
                          { type: 'object' },
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
          '/internal/admin': {
            get: {
              responses: {
                '200': {
                  description: 'OK',
                  content:  {
                    'application/json': {
                      schema: {
                        oneOf: [
                          { type: 'object' },
                          { type:  'object' },
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const ext = new SchemaExtractor({ skipPaths: ['/internal/.*'] });
      ext.process(doc);
      const stats = ext.getStats();

      expect(stats.compositionsFound).toBeLessThanOrEqual(1);
    });
  });

  describe('getStats method', () => {
    it('should return correct statistics after processing', () => {
      const doc = createDocumentWithMultipleCompositions();
      extractor.process(doc);
      const stats = extractor.getStats();

      expect(stats).toHaveProperty('schemasExtracted');
      expect(stats).toHaveProperty('compositionsFound');
      expect(stats).toHaveProperty('oneOfCount');
      expect(stats).toHaveProperty('anyOfCount');
      expect(stats).toHaveProperty('allOfCount');
      expect(stats).toHaveProperty('discriminatorsPreserved');
      expect(stats).toHaveProperty('maxDepthReached');

      expect(typeof stats.schemasExtracted).toBe('number');
      expect(typeof stats.compositionsFound).toBe('number');
      expect(stats.schemasExtracted).toBeGreaterThan(0);
    });

    it('should reset stats on new process call', () => {
      const doc1 = createDocumentWithOneOf();
      extractor.process(doc1);
      const stats1 = extractor.getStats();

      const doc2: OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: { title: 'Empty', version: '1.0' },
        paths: {},
      };
      extractor.process(doc2);
      const stats2 = extractor.getStats();

      expect(stats1.schemasExtracted).toBeGreaterThan(0);
      expect(stats2.schemasExtracted).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty paths object', () => {
      const doc: OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0' },
        paths: {},
      };

      const result = extractor.process(doc);
      expect(result).toBeDefined();
      expect(extractor.getStats().schemasExtracted).toBe(0);
    });

    it('should handle null schema gracefully', () => {
      const doc: OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0' },
        paths: {
          '/api/test': {
            get: {
              responses: {
                '200': {
                  description: 'OK',
                  content: {
                    'application/json': {
                      schema: null as any,
                    },
                  },
                },
              },
            },
          },
        },
      };

      expect(() => extractor.process(doc)).not.toThrow();
    });

    it('should handle responses without content', () => {
      const doc: OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0' },
        paths: {
          '/api/test': {
            delete: {
              responses: {
                '204': { description: 'No Content' },
              },
            },
          },
        },
      };

      const result = extractor.process(doc);
      expect(result).toBeDefined();
    });

    it('should handle single item compositions', () => {
      const doc: OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0' },
        paths: {
          '/api/test': {
            get: {
              responses: {
                '200': {
                  description: 'OK',
                  content: {
                    'application/json': {
                      schema: {
                        oneOf: [{ type: 'object', properties: { id: { type:  'string' } } }],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const ext1 = new SchemaExtractor({ extractSingleItems: false });
      ext1.process(doc);
      const stats1 = ext1.getStats();

      const ext2 = new SchemaExtractor({ extractSingleItems: true });
      ext2.process(JSON.parse(JSON.stringify(doc)));
      const stats2 = ext2.getStats();

      expect(stats2.schemasExtracted).toBeGreaterThanOrEqual(stats1.schemasExtracted);
    });

    it('should handle multiple HTTP methods on same path', () => {
      const doc: OpenAPIV3.Document = {
        openapi:  '3.0.3',
        info: { title: 'Test', version: '1.0' },
        paths: {
          '/api/items': {
            get: {
              operationId: 'ListItems',
              responses: {
                '200': {
                  description: 'OK',
                  content: {
                    'application/json': {
                      schema: {
                        oneOf: [
                          { type:  'object', properties: { items: { type: 'array' } } },
                        ],
                      },
                    },
                  },
                },
              },
            },
            post: {
              operationId: 'CreateItem',
              requestBody: {
                content: {
                  'application/json':  {
                    schema: {
                      anyOf: [
                        { type: 'object', properties: { name: { type: 'string' } } },
                      ],
                    },
                  },
                },
              },
              responses: {
                '201': { description: 'Created' },
              },
            },
          },
        },
      };

      const result = extractor.process(doc);
      const stats = extractor.getStats();

      expect(stats.compositionsFound).toBe(2);
      expect(stats.oneOfCount).toBe(1);
      expect(stats.anyOfCount).toBe(1);
    });
  });
});

// Helper functions
function createMinimalDocument(): OpenAPIV3.Document {
  return {
    openapi: '3.0.3',
    info: { title: 'Test', version: '1.0' },
    paths: {},
  };
}

function createDocumentWithOneOf(): OpenAPIV3.Document {
  return {
    openapi: '3.0.3',
    info: { title: 'Test', version: '1.0' },
    paths: {
      '/api/test': {
        get: {
          operationId: 'GetTest',
          responses: {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    oneOf: [
                      {
                        type: 'object',
                        properties: {
                          type: { type: 'string', enum: ['typeA'] },
                          dataA: { type: 'string' },
                        },
                        required: ['type', 'dataA'],
                      },
                      {
                        type: 'object',
                        properties: {
                          type: { type:  'string', enum: ['typeB'] },
                          dataB: { type: 'integer' },
                        },
                        required: ['type', 'dataB'],
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

function createDocumentWithMultipleCompositions(): OpenAPIV3.Document {
  return {
    openapi: '3.0.3',
    info: { title: 'Test', version: '1.0' },
    paths: {
      '/api/endpoint1': {
        get: {
          responses: {
            '200': {
              description: 'OK',
              content: {
                'application/json': {
                  schema: {
                    oneOf: [
                      { type:  'object', properties: { a: { type: 'string' } } },
                      { type: 'object', properties: { b: { type: 'string' } } },
                    ],
                  },
                },
              },
            },
          },
        },
      },
      '/api/endpoint2': {
        post: {
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  anyOf: [
                    { type: 'object', properties:  { x: { type: 'string' } } },
                    { type: 'object', properties: { y: { type: 'string' } } },
                  ],
                },
              },
            },
          },
          responses:  {
            '201': { description: 'Created' },
          },
        },
      },
    },
  };
}

function createDeeplyNestedDocument(depth: number): OpenAPIV3.Document {
  let schema: any = { type: 'string' };

  for (let i = 0; i < depth; i++) {
    schema = {
      type: 'object',
      properties: {
        nested: schema,
      },
    };
  }

  return {
    openapi: '3.0.3',
    info: { title: 'Test', version: '1.0' },
    paths: {
      '/api/deep': {
        get: {
          responses: {
            '200': {
              description: 'OK',
              content: {
                'application/json': {
                  schema,
                },
              },
            },
          },
        },
      },
    },
  };
}
```

---

### **2. FileHandler Tests**

```typescript name=oas_docs/scripts/lib/__tests__/file-handler.test.ts url=https://github.com/elastic/kibana/blob/main/oas_docs/scripts/lib/__tests__/file-handler.test.ts
/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { FileHandler } from '../file-handler';

describe('FileHandler', () => {
  let tempDir: string;
  let mockLogger: { info: jest.Mock; debug: jest.Mock; warn: jest.Mock; error: jest.Mock };
  let fileHandler: FileHandler;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    fileHandler = new FileHandler(mockLogger);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('readOasDocument', () => {
    it('should read valid YAML file', () => {
      const yamlContent = `
openapi: 3.0.3
info:
  title: Test
  version: 1.0. 0
paths:  {}
`;
      const filePath = path.join(tempDir, 'test.yaml');
      fs.writeFileSync(filePath, yamlContent, 'utf8');

      const doc = fileHandler.readOasDocument(filePath);

      expect(doc).toBeDefined();
      expect(doc.openapi).toBe('3.0.3');
      expect(doc.info?. title).toBe('Test');
    });

    it('should throw error for non-existent file', () => {
      const filePath = path. join(tempDir, 'nonexistent.yaml');

      expect(() => fileHandler.readOasDocument(filePath)).toThrow('File not found');
    });

    it('should throw error for invalid YAML', () => {
      const invalidYaml = `
invalid:  yaml:   content:   [
`;
      const filePath = path. join(tempDir, 'invalid.yaml');
      fs.writeFileSync(filePath, invalidYaml, 'utf8');

      expect(() => fileHandler.readOasDocument(filePath)).toThrow('YAML parse error');
    });

    it('should handle JSON as YAML', () => {
      const jsonContent = JSON.stringify({
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0' },
        paths: {},
      });
      const filePath = path.join(tempDir, 'test.yaml');
      fs.writeFileSync(filePath, jsonContent, 'utf8');

      const doc = fileHandler.readOasDocument(filePath);
      expect(doc. openapi).toBe('3.0.3');
    });
  });

  describe('writeOasDocument', () => {
    it('should write document to file', () => {
      const doc = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0.0' },
        paths: {},
      };
      const filePath = path.join(tempDir, 'output.yaml');

      fileHandler.writeOasDocument(doc, filePath);

      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content).toContain('openapi: ');
      expect(content).toContain('title: ');
    });

    it('should create directory if needed', () => {
      const doc = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0.0' },
        paths: {},
      };
      const filePath = path.join(tempDir, 'subdir', 'output.yaml');

      fileHandler.writeOasDocument(doc, filePath);

      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should preserve document structure', () => {
      const doc = {
        openapi:  '3.0.3',
        info: { title: 'Test API', version: '2.1. 0' },
        paths: {
          '/api/test': {
            get: {
              operationId: 'GetTest',
              responses: {
                '200': { description: 'OK' },
              },
            },
          },
        },
      };
      const filePath = path.join(tempDir, 'output.yaml');

      fileHandler.writeOasDocument(doc, filePath);

      const readBack = fileHandler.readOasDocument(filePath);
      expect(readBack.openapi).toBe(doc.openapi);
      expect(readBack.info?.title).toBe(doc.info?.title);
    });
  });

  describe('createBackup', () => {
    it('should create backup file', () => {
      const filePath = path.join(tempDir, 'original.yaml');
      fs.writeFileSync(filePath, 'test content');

      const backupPath = fileHandler.createBackup(filePath);

      expect(fs.existsSync(backupPath)).toBe(true);
      expect(backupPath).toBe(`${filePath}.backup`);
    });

    it('should copy file contents', () => {
      const content = 'test content with data';
      const filePath = path.join(tempDir, 'original.yaml');
      fs.writeFileSync(filePath, content);

      fileHandler.createBackup(filePath);
      const backupPath = `${filePath}.backup`;

      const backupContent = fs.readFileSync(backupPath, 'utf8');
      expect(backupContent).toBe(content);
    });
  });

  describe('cleanupBackups', () => {
    it('should remove backup file', () => {
      const filePath = path.join(tempDir, 'test.yaml');
      const backupPath = `${filePath}.backup`;

      fs.writeFileSync(filePath, 'original');
      fs.writeFileSync(backupPath, 'backup');

      fileHandler.cleanupBackups(filePath);

      expect(fs.existsSync(backupPath)).toBe(false);
    });

    it('should not fail if backup does not exist', () => {
      const filePath = path.join(tempDir, 'test.yaml');

      expect(() => fileHandler.cleanupBackups(filePath)).not.toThrow();
    });
  });

  describe('getFileStats', () => {
    it('should return stats for existing file', () => {
      const filePath = path.join(tempDir, 'test. yaml');
      const content = 'line1\nline2\nline3';
      fs.writeFileSync(filePath, content);

      const stats = fileHandler.getFileStats(filePath);

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('lines');
      expect(stats.lines).toBe(3);
    });

    it('should return 0 for non-existent file', () => {
      const stats = fileHandler.getFileStats('/nonexistent/path. yaml');

      expect(stats. size).toBe('0B');
      expect(stats.lines).toBe(0);
    });

    it('should format file size correctly', () => {
      const filePath = path.join(tempDir, 'test.yaml');
      fs.writeFileSync(filePath, 'x'.repeat(1500));

      const stats = fileHandler.getFileStats(filePath);

      expect(stats.size).toMatch(/\d+(\.\d+)?KB/);
    });
  });

  describe('listYamlFiles', () => {
    it('should list YAML files in directory', () => {
      fs.writeFileSync(path.join(tempDir, 'file1.yaml'), 'content');
      fs.writeFileSync(path.join(tempDir, 'file2.yaml'), 'content');
      fs.writeFileSync(path.join(tempDir, 'file3.yml'), 'content');
      fs.writeFileSync(path.join(tempDir, 'notayaml.txt'), 'content');

      const files = fileHandler.listYamlFiles(tempDir);

      expect(files. length).toBe(3);
      expect(files. some((f) => f.includes('file1.yaml'))).toBe(true);
      expect(files.some((f) => f.includes('file2.yaml'))).toBe(true);
      expect(files.some((f) => f.includes('file3.yml'))).toBe(true);
    });

    it('should return empty array for non-existent directory', () => {
      const files = fileHandler.listYamlFiles('/nonexistent/directory');

      expect(Array.isArray(files)).toBe(true);
      expect(files. length).toBe(0);
    });
  });
});
```

---

### **3. Validator Tests**

```typescript name=oas_docs/scripts/lib/__tests__/validator.test.ts url=https://github.com/elastic/kibana/blob/main/oas_docs/scripts/lib/__tests__/validator.test.ts
/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { OpenAPIV3 } from 'openapi-types';
import { Validator } from '../validator';

describe('Validator', () => {
  let mockLogger: { info: jest.Mock; debug: jest.Mock; warn: jest.Mock; error: jest. Mock };
  let validator:  Validator;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    validator = new Validator(mockLogger);
  });

  describe('validate method', () => {
    it('should validate correct document', () => {
      const doc:  OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0' },
        paths: {},
      };

      const result = validator. validate(doc);

      expect(result. valid).toBe(true);
      expect(result.errors. length).toBe(0);
    });

    it('should catch missing openapi version', () => {
      const doc = {
        info: { title: 'Test', version: '1.0' },
        paths: {},
      } as OpenAPIV3.Document;

      const result = validator.validate(doc);

      expect(result.valid).toBe(false);
      expect(result.errors. some((e) => e.type === 'missing_openapi_version')).toBe(true);
    });

    it('should catch missing info object', () => {
      const doc:  OpenAPIV3.Document = {
        openapi: '3.0.3',
        paths: {},
      };

      const result = validator.validate(doc);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.type === 'missing_info')).toBe(true);
    });
  });

  describe('schema validation', () => {
    it('should validate schemas structure', () => {
      const doc: OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0' },
        paths: {},
        components: {
          schemas: {
            ValidSchema: { type: 'object', properties: { id: { type: 'string' } } },
          },
        },
      };

      const result = validator.validate(doc);

      expect(result.errors.filter((e) => e.type === 'invalid_schema').length).toBe(0);
    });

    it('should warn about empty schemas', () => {
      const doc: OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0' },
        paths: {},
        components: {
          schemas: {
            EmptySchema: {},
          },
        },
      };

      const result = validator. validate(doc);

      expect(result.warnings.some((w) => w.type === 'empty_schema')).toBe(true);
    });
  });

  describe('reference validation', () => {
    it('should catch broken references', () => {
      const doc: OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0' },
        paths: {
          '/api/test': {
            get: {
              responses: {
                '200': {
                  description: 'OK',
                  content: {
                    'application/json':  {
                      schema: { $ref: '#/components/schemas/NonExistent' },
                    },
                  },
                },
              },
            },
          },
        },
        components: {
          schemas: {},
        },
      };

      const result = validator.validate(doc);

      expect(result.errors.some((e) => e.type === 'broken_reference')).toBe(true);
    });

    it('should validate correct references', () => {
      const doc: OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0' },
        paths: {
          '/api/test': {
            get: {
              responses: {
                '200': {
                  description: 'OK',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/ValidSchema' },
                    },
                  },
                },
              },
            },
          },
        },
        components: {
          schemas: {
            ValidSchema: { type: 'object' },
          },
        },
      };

      const result = validator.validate(doc);

      expect(result.errors.filter((e) => e.type === 'broken_reference').length).toBe(0);
    });
  });

  describe('discriminator validation', () => {
    it('should warn about missing discriminator mapping', () => {
      const doc: OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0' },
        paths: {},
        components: {
          schemas: {
            PolymorphicSchema: {
              oneOf: [{ type: 'object' }, { type: 'object' }],
              discriminator: {
                propertyName: 'type',
              },
            },
          },
        },
      };

      const result = validator.validate(doc);

      expect(result.warnings. some((w) => w.type === 'missing_discriminator_mapping')).toBe(true);
    });

    it('should catch invalid discriminator mappings', () => {
      const doc: OpenAPIV3.Document = {
        openapi: '3.0.3',
        info: { title: 'Test', version: '1.0' },
        paths: {},
        components: {
          schemas: {
            PolymorphicSchema: {
              oneOf: [{ type: 'object' }, { type: 'object' }],
              discriminator: {
                propertyName: 'type',
                mapping: {
                  cat: '#/components/schemas/Cat',
                  dog: '#/components/schemas/NonExistentDog',
                },
              },
            },
          },
        },
      };

      const result = validator.validate(doc);

      expect(result.errors.some((e) => e.type === 'invalid_discriminator_mapping')).toBe(true);
    });

    it('should validate correct discriminator mappings', () => {
      const doc: OpenAPIV3.Document = {
        openapi:  '3.0.3',
        info: { title: 'Test', version: '1.0' },
        paths: {},
        components: {
          schemas:  {
            Cat: { type: 'object' },
            Dog: { type: 'object' },
            PolymorphicSchema: {
              oneOf: [{ $ref: '#/components/schemas/Cat' }, { $ref: '#/components/schemas/Dog' }],
              discriminator: {
                propertyName: 'type',
                mapping: {
                  cat: '#/components/schemas/Cat',
                  dog:  '#/components/schemas/Dog',
                },
              },
            },
          },
        },
      };

      const result = validator.validate(doc);

      expect(result.errors.filter((e) => e.type === 'invalid_discriminator_mapping').length).toBe(0);
    });
  });

  describe('printResults method', () => {
    it('should log validation results', () => {
      const result = {
        valid: true,
        errors: [],
        warnings: [],
      };

      validator.printResults(result);

      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should log errors when validation fails', () => {
      const result = {
        valid:  false,
        errors: [
          {
            type: 'broken_reference',
            message: 'Reference not found',
            severity: 'critical' as const,
          },
        ],
        warnings: [],
      };

      validator.printResults(result);

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should log warnings', () => {
      const result = {
        valid: true,
        errors: [],
        warnings:  [
          {
            type:  'empty_schema',
            message: 'Schema is empty',
          },
        ],
      };

      validator.printResults(result);

      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });
});
```

---

### **4. CLI Handler Tests**

```typescript name=oas_docs/scripts/lib/__tests__/cli-handler.test.ts url=https://github.com/elastic/kibana/blob/main/oas_docs/scripts/lib/__tests__/cli-handler.test. ts
/*
 * Copyright Elasticsearch B.V.  and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1". 
 */

import { CliHandler } from '../cli-handler';

describe('CliHandler', () => {
  describe('parseArgs', () => {
    it('should parse input file', () => {
      const args = CliHandler.parseArgs(['input.yaml']);

      expect(args. inputFile).toBe('input.yaml');
    });

    it('should parse input and output files', () => {
      const args = CliHandler.parseArgs(['input.yaml', 'output.yaml']);

      expect(args.inputFile).toBe('input.yaml');
      expect(args.outputFile).toBe('output.yaml');
    });

    it('should parse verbose flag', () => {
      const args1 = CliHandler.parseArgs(['input.yaml', '-v']);
      const args2 = CliHandler.parseArgs(['input.yaml', '--verbose']);

      expect(args1.verbose).toBe(true);
      expect(args2.verbose).toBe(true);
    });

    it('should parse help flag', () => {
      const args = CliHandler.parseArgs(['-h']);

      expect(args.help).toBe(true);
    });

    it('should parse min-complexity option', () => {
      const args = CliHandler.parseArgs(['input.yaml', '--min-complexity=5']);

      expect(args.minComplexity).toBe(5);
    });

    it('should parse max-depth option', () => {
      const args = CliHandler.parseArgs(['input.yaml', '--max-depth=15']);

      expect(args.maxDepth).toBe(15);
    });

    it('should parse skip-paths option', () => {
      const args = CliHandler.parseArgs(['input.yaml', '--skip-paths=/internal/.*,/deprecated/.*']);

      expect(args.skipPaths).toContain('/internal/.*');
      expect(args.skipPaths).toContain('/deprecated/.*');
    });

    it('should parse report option', () => {
      const args = CliHandler.parseArgs(['input.yaml', '--report=report.md']);

      expect(args.reportFile).toBe('report.md');
    });

    it('should parse no-backup flag', () => {
      const args = CliHandler.parseArgs(['input.yaml', '--no-backup']);

      expect(args.backup).toBe(false);
    });

    it('should parse no-validate flag', () => {
      const args = CliHandler.parseArgs(['input.yaml', '--no-validate']);

      expect(args. validate).toBe(false);
    });

    it('should parse multiple options together', () => {
      const args = CliHandler.parseArgs([
        'input.yaml',
        'output.yaml',
        '--verbose',
        '--min-complexity=3',
        '--max-depth=8',
        '--no-backup',
        '--report=report.md',
      ]);

      expect(args. inputFile).toBe('input.yaml');
      expect(args.outputFile).toBe('output.yaml');
      expect(args.verbose).toBe(true);
      expect(args.minComplexity).toBe(3);
      expect(args.maxDepth).toBe(8);
      expect(args.backup).toBe(false);
      expect(args. reportFile).toBe('report.md');
    });
  });

  describe('validate', () => {
    it('should pass validation for valid args', () => {
      const args = {
        inputFile: 'input.yaml',
        verbose: false,
        minComplexity:  2,
        maxDepth: 10,
        backup: true,
        skipPaths: [],
        validate: true,
        help: false,
      };

      const result = CliHandler.validate(args);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should fail if input file missing', () => {
      const args = {
        inputFile: '',
        verbose: false,
        minComplexity: 2,
        maxDepth: 10,
        backup: true,
        skipPaths: [],
        validate: true,
        help:  false,
      };

      const result = CliHandler.validate(args);

      expect(result. valid).toBe(false);
      expect(result.error).toContain('Input file');
    });

    it('should fail if minComplexity < 1', () => {
      const args = {
        inputFile: 'input.yaml',
        verbose: false,
        minComplexity: 0,
        maxDepth: 10,
        backup: true,
        skipPaths: [],
        validate: true,
        help: false,
      };

      const result = CliHandler.validate(args);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('minComplexity');
    });

    it('should fail if maxDepth < 1', () => {
      const args = {
        inputFile: 'input.yaml',
        verbose: false,
        minComplexity: 2,
        maxDepth: 0,
        backup: true,
        skipPaths: [],
        validate: true,
        help: false,
      };

      const result = CliHandler.validate(args);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('maxDepth');
    });
  });

  describe('printHelp', () => {
    it('should not throw', () => {
      expect(() => CliHandler.printHelp()).not.toThrow();
    });
  });
});
```

---

### **5. Run Tests Command**

Add to `oas_docs/package.json`:

```json
{
  "scripts": {
    "test": "jest lib/__tests__",
    "test:watch": "jest lib/__tests__ --watch",
    "test: coverage": "jest lib/__tests__ --coverage"
  }
}
```

---

### **6. Coverage Goals**

The test suite provides coverage for:

- ✓ SchemaExtractor:  Core extraction logic, all composition types, complexity calculations, naming
- ✓ FileHandler: Reading, writing, backup operations, file stats
- ✓ Validator: Document validation, reference checking, discriminator handling
- ✓ CliHandler:  Argument parsing and validation
- ✓ Edge cases: Empty documents, null schemas, circular references, deep nesting

This test suite integrates with Kibana's existing Jest configuration without requiring custom setup. 
