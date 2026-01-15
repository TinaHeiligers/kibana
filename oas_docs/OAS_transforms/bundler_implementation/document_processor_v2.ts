/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */
// Document Processor to extract inline schemas to components/schemas
// The main issue was the processor trying to mutate nodes during traversal. Here's the corrected version:

import type { OpenAPIV3 } from 'openapi-types';
import type { DocumentNodeProcessor } from './types/document_node_processor';
import type { TraverseDocumentNodeContext } from './types/traverse_document_node_context';
import { isPlainObjectType } from '../../../utils/is_plain_object_type';

export interface ExtractInlineSchemasOptions {
  minComplexity?: number;
  maxDepth?: number;
  excludePatterns?: RegExp[];
  extractSingleItems?: boolean;
  namingPrefix?: string;
}

interface SchemaToExtract {
  path: string[];
  schema: OpenAPIV3.SchemaObject;
  name: string;
  metadata: {
    operationId?: string;
    method?: string;
    statusCode?: string;
  };
}

interface SchemaRefTracker {
  schemasToExtract: Map<string, SchemaToExtract>;
  extractedSchemas: Map<string, OpenAPIV3.SchemaObject>;
  nameCounters: Map<string, number>;
}

/**
 * Creates a document processor that extracts inline schemas to components/schemas
 */
export function createExtractInlineSchemasProcessor(
  options: ExtractInlineSchemasOptions = {}
): DocumentNodeProcessor {
  const {
    minComplexity = 3,
    maxDepth = 10,
    extractSingleItems = false,
    namingPrefix = 'Generated',
  } = options;

  let document: OpenAPIV3.Document;
  const tracker: SchemaRefTracker = {
    schemasToExtract: new Map(),
    extractedSchemas: new Map(),
    nameCounters: new Map(),
  };

  return {
    onNodeEnter(node: unknown, context: TraverseDocumentNodeContext) {
      // Store document reference on first entry
      if (context.path.length === 0 && isPlainObjectType(node)) {
        document = node as OpenAPIV3.Document;
      }

      // Only process schema objects in request/response bodies
      if (!isPlainObjectType(node)) return;
      if (!isSchemaLocation(context.path)) return;

      // Check for composition operators
      const compositionType = getCompositionType(node);
      if (!compositionType) return;

      const items = node[compositionType] as OpenAPIV3.SchemaObject[];
      if (!items || items.length === 0) return;

      // Skip single items unless configured to extract them
      if (items.length === 1 && !extractSingleItems) return;

      // Skip if all items are already references
      if (items.every((item) => isRefSchema(item))) return;

      // Calculate complexity
      const complexity = calculateComplexity(node, context.path.length, compositionType);
      if (complexity < minComplexity) return;
      if (context.path.length >= maxDepth) return;

      // Mark for extraction
      const pathKey = context.path.join('/');
      const metadata = extractMetadata(context.path);
      const baseName = generateSchemaName(context.path, compositionType, namingPrefix, metadata);
      const uniqueName = ensureUniqueName(baseName, tracker);

      tracker.schemasToExtract.set(pathKey, {
        path: [...context.path],
        schema: JSON.parse(JSON.stringify(node)), // Deep clone
        name: uniqueName,
        metadata,
      });

      // Also extract individual complex items
      items.forEach((item, index) => {
        if (isRefSchema(item)) return;

        const itemComplexity = calculateComplexity(item, context.path.length + 1);
        if (itemComplexity >= minComplexity && isPlainObjectType(item)) {
          const itemName = `${uniqueName}Item${index}`;
          const itemPathKey = `${pathKey}/${compositionType}/${index}`;

          tracker.schemasToExtract.set(itemPathKey, {
            path: [...context.path, compositionType, index],
            schema: JSON.parse(JSON.stringify(item)),
            name: itemName,
            metadata,
          });
        }
      });
    },

    afterTraverse() {
      if (!document || tracker.schemasToExtract.size === 0) return;

      // Ensure components.schemas exists
      if (!document.components) {
        document.components = {};
      }
      if (!document.components.schemas) {
        document.components.schemas = {};
      }

      // Add all extracted schemas to components
      for (const extraction of tracker.schemasToExtract.values()) {
        tracker.extractedSchemas.set(extraction.name, extraction.schema);
        document.components.schemas[extraction.name] = extraction.schema;
      }

      // Replace inline schemas with $ref - CRITICAL: do this AFTER adding to components
      replaceInlineSchemasWithRefs(document, tracker.schemasToExtract);
    },
  };
}

/**
 * Replaces inline schemas with $ref pointers
 */
function replaceInlineSchemasWithRefs(
  document: OpenAPIV3.Document,
  schemasToExtract: Map<string, SchemaToExtract>
): void {
  if (!document.paths) return;

  for (const [pathName, pathItem] of Object.entries(document.paths)) {
    if (!pathItem) continue;

    for (const [method, operation] of Object.entries(pathItem)) {
      if (method === 'parameters' || method === 'servers' || !operation) continue;

      const op = operation as OpenAPIV3.OperationObject;

      // Replace in request body
      if (op.requestBody && typeof op.requestBody === 'object') {
        replaceInMediaTypeObject(
          op.requestBody as OpenAPIV3.RequestBodyObject,
          ['paths', pathName, method, 'requestBody'],
          schemasToExtract
        );
      }

      // Replace in responses
      if (op.responses) {
        for (const [statusCode, response] of Object.entries(op.responses)) {
          if (typeof response === 'object' && response) {
            replaceInMediaTypeObject(
              response as OpenAPIV3.ResponseObject,
              ['paths', pathName, method, 'responses', statusCode],
              schemasToExtract
            );
          }
        }
      }
    }
  }
}

function replaceInMediaTypeObject(
  mediaContainer: { content?: Record<string, OpenAPIV3.MediaTypeObject> },
  basePath: string[],
  schemasToExtract: Map<string, SchemaToExtract>
): void {
  if (!mediaContainer.content) return;

  for (const [contentType, mediaType] of Object.entries(mediaContainer.content)) {
    if (!mediaType.schema) continue;

    const schemaPath = [...basePath, 'content', contentType, 'schema'];
    const pathKey = schemaPath.join('/');
    const extraction = schemasToExtract.get(pathKey);

    if (extraction) {
      // Replace the schema object with a $ref
      mediaType.schema = {
        $ref: `#/components/schemas/${extraction.name}`,
      };
    } else {
      // Check if this is a composition that needs updating
      replaceCompositionItems(mediaType.schema, schemaPath, schemasToExtract);
    }
  }
}

function replaceCompositionItems(
  schema: any,
  basePath: string[],
  schemasToExtract: Map<string, SchemaToExtract>
): void {
  if (!isPlainObjectType(schema)) return;

  for (const compositionType of ['oneOf', 'anyOf', 'allOf'] as const) {
    if (!(compositionType in schema)) continue;

    const items = schema[compositionType] as any[];
    if (!Array.isArray(items)) continue;

    // Replace individual items with refs if they were extracted
    schema[compositionType] = items.map((item, index) => {
      const itemPath = [...basePath, compositionType, index];
      const pathKey = itemPath.join('/');
      const extraction = schemasToExtract.get(pathKey);

      if (extraction) {
        return { $ref: `#/components/schemas/${extraction.name}` };
      }

      return item;
    });
  }
}

function extractMetadata(path: readonly (string | number)[]): {
  operationId?: string;
  method?: string;
  statusCode?: string;
} {
  const metadata: { operationId?: string; method?: string; statusCode?: string } = {};

  // Find method (get, post, etc.)
  const methodIndex = path.findIndex((p) =>
    ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(String(p))
  );
  if (methodIndex >= 0) {
    metadata.method = String(path[methodIndex]);
  }

  // Find status code in responses
  const responsesIndex = path.indexOf('responses');
  if (responsesIndex >= 0 && responsesIndex + 1 < path.length) {
    const potentialStatusCode = String(path[responsesIndex + 1]);
    if (/^\d{3}$/.test(potentialStatusCode)) {
      metadata.statusCode = potentialStatusCode;
    }
  }

  // Find operationId - would need to traverse document, skip for now
  // Can be added by looking at parent operation object if needed

  return metadata;
}

function generateSchemaName(
  path: readonly (string | number)[],
  compositionType: string,
  prefix: string,
  metadata: { operationId?: string; method?: string; statusCode?: string }
): string {
  // Use operationId if available
  if (metadata.operationId) {
    const suffix = determineTypeSuffix(path, metadata);
    return sanitizeName(`${metadata.operationId}${suffix}`);
  }

  // Generate from path structure
  const pathSegments: string[] = [];
  for (const segment of path) {
    const str = String(segment);
    // Skip technical segments
    if (['paths', 'content', 'schema', 'requestBody', 'responses'].includes(str)) continue;
    // Skip content types
    if (str.includes('/')) continue;
    // Skip composition types
    if (['oneOf', 'anyOf', 'allOf'].includes(str)) continue;
    // Skip numeric indices
    if (/^\d+$/.test(str)) continue;

    pathSegments.push(str);
  }

  const method = metadata.method ? metadata.method.toUpperCase() : '';
  const statusCode = metadata.statusCode || '';
  const pathPart = pathSegments.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('');

  return sanitizeName(`${prefix}${pathPart}${method}${statusCode}`);
}

function sanitizeName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_]/g, '')
    .replace(/^[0-9]/, '_$&')
    .replace(/^[a-z]/, (c) => c.toUpperCase())
    .replace(/^$/, 'GeneratedSchema'); // Fallback if empty
}

function determineTypeSuffix(
  path: readonly (string | number)[],
  metadata: { statusCode?: string }
): string {
  if (path.includes('requestBody')) return 'Request';
  if (path.includes('responses') && metadata.statusCode) {
    return `Response${metadata.statusCode}`;
  }
  return 'Schema';
}

function ensureUniqueName(baseName: string, tracker: SchemaRefTracker): string {
  if (!tracker.extractedSchemas.has(baseName)) {
    return baseName;
  }

  let counter = tracker.nameCounters.get(baseName) || 1;
  let uniqueName = `${baseName}${counter}`;

  while (tracker.extractedSchemas.has(uniqueName)) {
    counter++;
    uniqueName = `${baseName}${counter}`;
  }

  tracker.nameCounters.set(baseName, counter + 1);
  return uniqueName;
}

function isSchemaLocation(path: readonly (string | number)[]): boolean {
  const pathStr = path.join('/');
  return (
    (pathStr.includes('/requestBody/') || pathStr.includes('/responses/')) &&
    pathStr.includes('/schema')
  );
}

function getCompositionType(node: any): 'oneOf' | 'anyOf' | 'allOf' | undefined {
  if ('oneOf' in node && Array.isArray(node.oneOf)) return 'oneOf';
  if ('anyOf' in node && Array.isArray(node.anyOf)) return 'anyOf';
  if ('allOf' in node && Array.isArray(node.allOf)) return 'allOf';
  return undefined;
}

function isRefSchema(schema: unknown): boolean {
  return typeof schema === 'object' && schema !== null && '$ref' in schema;
}

function calculateComplexity(schema: any, depth: number, compositionType?: string): number {
  let score = 1 + depth;

  if (!isPlainObjectType(schema)) return score;

  // Add for properties
  if ('properties' in schema && isPlainObjectType(schema.properties)) {
    score += Object.keys(schema.properties).length;
  }

  // Add for composition items
  if (compositionType && compositionType in schema) {
    const items = schema[compositionType];
    if (Array.isArray(items)) {
      score += items.length * 2;

      // Extra points for nested compositions
      items.forEach((item: any) => {
        if (
          isPlainObjectType(item) &&
          (['oneOf', 'anyOf', 'allOf'] as const).some((t) => t in item)
        ) {
          score += 3;
        }
      });
    }
  }

  // Add for discriminator
  if ('discriminator' in schema) {
    score += 2;
  }

  return score;
}
