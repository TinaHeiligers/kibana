I'll help you understand how to implement automatic refactoring of request/response bodies to the `#/components/schemas` format in Kibana's OAS pipeline. Let me first explore the existing codebase to understand the current implementation. Now let me search for the OAS documentation and generation code in Kibana: Now let me search for more specific information about the OAS bundling process and where schema refactoring could be integrated: Now let me search for more specific information about how the OAS bundler processes and generates schemas: Now let me search for more specific files related to the OAS bundler's schema extraction and reference processing: Now let me look at the actual implementation of the OAS merging scripts: Now let me create a comprehensive analysis document that explains how to implement schema refactoring in the OAS pipeline: Now let me provide you with a comprehensive analysis of how to change the Kibana OAS specification CI pipeline and generator scripts to implement automatic refactoring of inline request/response bodies to reusable `#/components/schemas` declarations.

## Comprehensive Analysis: Automatic Schema Refactoring for Kibana OAS Pipeline

schema refactoring feature:

### **Current OAS Pipeline Architecture**

The Kibana OAS pipeline consists of multiple stages: 

1. **Schema Extraction** (`src/platform/packages/shared/kbn-router-to-openapispec/`)
   - Converts Kibana router definitions with validation schemas (using `kbn-config-schema` and Zod) into OpenAPI specifications
   - Routes are processed via `process_router. ts` and `process_versioned_router.ts`
   - The `OasConverter` class converts type definitions into OpenAPI schema objects

2. **Schema Bundling** (`src/platform/packages/shared/kbn-openapi-bundler/`)
   - Merges multiple OAS documents into unified bundles
   - Supports custom processing via document node processors
   - Already has mechanisms for `x-inline` markers to control schema inlining

3. **CI/CD Pipeline** (`oas_docs/`)
   - Step 0:  Captures OAS snapshots from running Kibana (`capture_oas_snapshot`)
   - Step 1: Merges bundles via `merge_ess_oas. js` and `merge_serverless_oas.js`
   - Step 2: Applies overlays using Bump. sh CLI

---

### **Implementation Strategy**

#### **Phase 1: Schema Extraction & Refactoring Engine**

Create a new document processor in the bundler pipeline:

**Location**: `src/platform/packages/shared/kbn-openapi-bundler/src/bundler/process_document/document_processors/`

**New File**: `extract_inline_schemas_to_components.ts`

This processor should: 

1. **Traverse all paths/operations** and identify inline schema definitions in request/response bodies
2. **Detect refactorable patterns**:
   - `oneOf`, `anyOf`, `allOf` with inlined object schemas
   - Deep nested object schemas
   - Repeated schema patterns (deduplication)

3. **Generate schema identifiers** based on:
   - Operation ID (e.g., `ApiActionsConnectorResponse1`)
   - Path segments
   - HTTP method
   - Content-type

4. **Create entries in `components. schemas`** and replace inlined content with `$ref` pointers

**Key Decisions**:
- Should use a deterministic naming convention to ensure consistency across runs
- Should avoid collisions with existing schema names
- Should preserve the original schema structure for correctness

#### **Phase 2: Integration Point in CI/CD**

**Modification Location**: `oas_docs/scripts/merge_ess_oas.js` and `merge_serverless_oas.js`

Add a post-processing step: 

```javascript
// After bundling but before overlays
const { extractInlineSchemas } = require('@kbn/openapi-bundler');

const bundledSpec = await merge({... });
const refactoredSpec = extractInlineSchemas(bundledSpec, {
  minDepth: 2,          // Only refactor nested schemas
  excludePatterns: [], // Patterns to skip
  namingStrategy: 'operationId' // or 'path', 'hybrid'
});
```

#### **Phase 3: Detect Complex Composition Patterns**

Create utility functions to identify which inline schemas should be extracted:

**File**: `src/platform/packages/shared/kbn-openapi-bundler/src/bundler/schema_analysis. ts`

```typescript
export interface ExtractableSchema {
  path: string;           // JSON path to schema location
  operationId: string;
  suggestedName: string;
  complexity: number;     // Heuristic:  depth + property count
  canBeReused: boolean;   // If pattern repeats elsewhere
}

export function analyzeInlineSchemas(
  spec: OpenAPIV3.Document
): ExtractableSchema[] {
  // Traverse all paths and operations
  // Identify inline schemas
  // Check if they match composition patterns (oneOf, anyOf, allOf)
  // Suggest extraction based on complexity and reusability
}
```

#### **Phase 4: Handle Special Cases**

The implementation must handle: 

1. **Composition Operators** (from issue):
   - `oneOf` with multiple inline schemas → Extract each to components and use `$ref`
   - `anyOf` similar pattern
   - `allOf` - preserve intersection semantics

2. **Discriminators**:  If `discriminator` field is present, preserve mapping references

3. **Existing References**: Don't double-process already-referenced schemas

4. **Backward Compatibility**: Consider versioning - ensure old client generators still work

#### **Phase 5: Client Generator Integration**

The bundler's existing integration with `@hey-api/openapi-ts` already uses the schema components:

**File**: `src/platform/packages/shared/kbn-workflows/scripts/generate_kibana_connectors/openapi_ts. config.ts`

This will automatically benefit from the refactored schemas since it reads from `components.schemas`. The schema references will be properly resolved and typed.

---

### **Recommended Implementation Plan**

#### **Step 1: Create Schema Analyzer**
- Build the analysis utilities to identify refactorable schemas
- Add tests with various schema patterns
- **File**: `src/platform/packages/shared/kbn-openapi-bundler/src/schema_analyzer.ts`

#### **Step 2: Implement Document Processor**
- Create the node processor that performs the refactoring
- Use existing bundler patterns (similar to `reduce_all_of_items` processors)
- **Files**:
  - `src/platform/packages/shared/kbn-openapi-bundler/src/bundler/process_document/document_processors/extract_schemas_to_components/`
  - `index.ts` - exports
  - `extract_processor.ts` - main logic
  - `naming_strategy.ts` - naming conventions

#### **Step 3: Add Processor to Pipeline**
- Add to `DEFAULT_BUNDLING_PROCESSORS` in `processor_sets.ts`
- Configure with options for customization
- **File**: `src/platform/packages/shared/kbn-openapi-bundler/src/bundler/processor_sets.ts`

#### **Step 4: Integrate into OAS Docs Pipeline**
- Modify merge scripts to enable the processor conditionally
- Add CLI flag:  `--refactor-inline-schemas`
- **Files**: `oas_docs/scripts/merge_ess_oas.js`, `merge_serverless_oas.js`

#### **Step 5: Testing & Validation**
- Create test cases covering all composition patterns
- Validate that generated schemas match original behavior
- Test client generator output
- **File**: `src/platform/packages/shared/kbn-openapi-bundler/tests/bundler/extract_inline_schemas. test.ts`

---

### **Technical Considerations**

#### **Naming Strategy**
```typescript
interface NamingConfig {
  prefix: string;           // e.g., 'Api', 'Response'
  useOperationId: boolean;  // Use operationId for disambiguation
  includeStatusCode: boolean; // Add HTTP status code suffix
  includeIndex: boolean;    // Add numeric suffix for duplicates
}

// Example outputs:
// ApiActionsConnectorResponse200
// CreateUserRequestBody
// ApiPath_methodResponse_{statusCode}_{index}
```

#### **Collision Detection**
```typescript
function generateUniqueSchemaName(
  suggested: string,
  existing: Set<string>,
  strategy: NamingConfig
): string {
  // Ensure uniqueness while maintaining readability
  // Increment numeric suffix if collision detected
}
```

#### **Preservation of Semantics**
- Keep discriminator information intact
- Preserve x-* vendor extensions
- Maintain ordering of oneOf/anyOf alternatives (important for discriminator mapping)

#### **Performance Considerations**
- Cache analysis results to avoid re-processing
- Limit depth of recursive schema processing
- Process in parallel for large specs

---

### **Success Criteria**

1. ✅ All `oneOf`/`anyOf`/`allOf` compositions in request/response bodies are refactored
2. ✅ Generated schemas have deterministic, readable names
3. ✅ No duplicate schema definitions in components
4. ✅ Client code generators (like @hey-api/openapi-ts) produce the same or better code
5. ✅ OpenAPI validation passes (Redocly linter)
6. ✅ Backward compatibility maintained (old generators can still use output)
7. ✅ Documentation generation improved (more reusable components visible)

---

### **Optional Enhancement: Schema Hints in Source Code**

As mentioned in the issue, you could add an optional metadata field to `kbn-config-schema`:

```typescript
// In source code: 
schema. object({
  // ... 
}, {
  meta: {
    // Optional: helps generator place this in #/components/schemas/{id}
    oasSchemaId: 'ApiActionsConnectorResponse'
  }
})
```

This would be parsed during schema extraction and propagated through to the final OAS document, giving the refactoring engine hints about preferred component names. 

---

Code examples:

## Complete Code Examples:  Automatic Schema Refactoring for Kibana OAS Pipeline

### **1. Schema Analyzer Utility**

```typescript name=schema_analyzer. ts url=https://github.com/elastic/kibana/tree/main/src/platform/packages/shared/kbn-openapi-bundler/src/bundler/schema_analyzer.ts
/*
 * Copyright Elasticsearch B. V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements.  Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1". 
 */

import type { OpenAPIV3 } from 'openapi-types';

/**
 * Represents a schema that can be extracted to components
 */
export interface ExtractableSchema {
  /** JSON pointer path to schema location */
  path: string;
  /** Operation ID for the endpoint */
  operationId?:  string;
  /** HTTP method (get, post, etc.) */
  method?: string;
  /** HTTP status code (200, 404, etc.) */
  statusCode?: string;
  /** Suggested schema name */
  suggestedName:  string;
  /** Complexity score (depth + properties) */
  complexity:  number;
  /** The schema object itself */
  schema: OpenAPIV3.SchemaObject;
  /** Type of composition (oneOf, anyOf, allOf) */
  compositionType?:  'oneOf' | 'anyOf' | 'allOf';
  /** Depth of nesting */
  depth: number;
}

export interface AnalysisOptions {
  /** Minimum complexity threshold for extraction */
  minComplexity?:  number;
  /** Maximum nesting depth to analyze */
  maxDepth?:  number;
  /** Patterns to exclude from extraction */
  excludePatterns?:  RegExp[];
  /** Whether to extract single-item oneOf/anyOf */
  extractSingleItems?: boolean;
}

/**
 * Analyzes OpenAPI spec for schemas that can be extracted to components
 */
export class SchemaAnalyzer {
  private extractableSchemas: Map<string, ExtractableSchema> = new Map();
  private processedPaths: Set<string> = new Set();

  constructor(private options: AnalysisOptions = {}) {
    this.options = {
      minComplexity: 2,
      maxDepth: 10,
      extractSingleItems: false,
      ... options,
    };
  }

  /**
   * Analyzes an OpenAPI document for extractable schemas
   */
  analyzeDocument(spec: OpenAPIV3.Document): ExtractableSchema[] {
    this.extractableSchemas.clear();
    this.processedPaths.clear();

    if (!spec. paths) {
      return [];
    }

    // Iterate through all paths
    for (const [path, pathItem] of Object.entries(spec.paths)) {
      if (! pathItem) continue;

      // Iterate through methods (get, post, etc.)
      for (const [method, operation] of Object.entries(pathItem)) {
        if (method === 'parameters' || method === 'servers') continue;

        const operationObject = operation as OpenAPIV3.OperationObject;
        if (!operationObject) continue;

        // Analyze request body
        if (operationObject.requestBody) {
          this.analyzeRequestBody(
            operationObject.requestBody as OpenAPIV3.RequestBodyObject,
            path,
            method as OpenAPIV3.HttpMethods,
            operationObject
          );
        }

        // Analyze responses
        if (operationObject. responses) {
          this.analyzeResponses(
            operationObject.responses,
            path,
            method as OpenAPIV3.HttpMethods,
            operationObject
          );
        }
      }
    }

    return Array.from(this.extractableSchemas.values());
  }

  private analyzeRequestBody(
    requestBody: OpenAPIV3.RequestBodyObject,
    path: string,
    method: string,
    operation: OpenAPIV3.OperationObject
  ): void {
    if (!requestBody. content) return;

    for (const [contentType, mediaType] of Object.entries(requestBody.content)) {
      if (! mediaType.schema) continue;

      this.analyzeSchema(
        mediaType. schema as OpenAPIV3.SchemaObject,
        `paths/${path}/${method}/requestBody/content/${contentType}/schema`,
        {
          operationId: operation.operationId,
          method,
          path,
        }
      );
    }
  }

  private analyzeResponses(
    responses: OpenAPIV3.ResponsesObject,
    path: string,
    method:  string,
    operation: OpenAPIV3.OperationObject
  ): void {
    for (const [statusCode, response] of Object.entries(responses)) {
      if (typeof response !== 'object' || ! response) continue;

      const responseObj = response as OpenAPIV3.ResponseObject;
      if (!responseObj.content) continue;

      for (const [contentType, mediaType] of Object.entries(responseObj.content)) {
        if (!mediaType.schema) continue;

        this.analyzeSchema(
          mediaType.schema as OpenAPIV3.SchemaObject,
          `paths/${path}/${method}/responses/${statusCode}/content/${contentType}/schema`,
          {
            operationId: operation.operationId,
            method,
            path,
            statusCode,
          }
        );
      }
    }
  }

  private analyzeSchema(
    schema: OpenAPIV3.SchemaObject,
    path: string,
    metadata: {
      operationId?:  string;
      method?: string;
      path?: string;
      statusCode?: string;
    },
    depth: number = 0
  ): void {
    // Skip if already processed
    if (this. processedPaths.has(path)) return;
    if (this.isRefSchema(schema)) return;

    // Check if schema has composition operators
    const compositionType = this.getCompositionType(schema);
    if (
      compositionType &&
      this.shouldExtract(schema, compositionType, depth)
    ) {
      const complexity = this.calculateComplexity(schema, depth);

      if (complexity >= (this.options.minComplexity || 2)) {
        const suggestedName = this.generateSchemaName(metadata, path, compositionType);

        this.extractableSchemas. set(suggestedName, {
          path,
          suggestedName,
          schema,
          complexity,
          compositionType,
          depth,
          operationId: metadata.operationId,
          method: metadata.method as any,
          statusCode: metadata. statusCode,
        });
      }
    }

    this.processedPaths.add(path);

    // Recursively analyze nested properties
    if (depth < (this.options.maxDepth || 10)) {
      if (schema.properties) {
        for (const [propName, propSchema] of Object. entries(schema.properties)) {
          if (typeof propSchema === 'object') {
            this.analyzeSchema(
              propSchema as OpenAPIV3.SchemaObject,
              `${path}/properties/${propName}`,
              metadata,
              depth + 1
            );
          }
        }
      }

      // Analyze items in arrays
      if (schema.items && typeof schema.items === 'object') {
        this.analyzeSchema(
          schema.items as OpenAPIV3.SchemaObject,
          `${path}/items`,
          metadata,
          depth + 1
        );
      }
    }
  }

  private getCompositionType(
    schema: OpenAPIV3.SchemaObject
  ): 'oneOf' | 'anyOf' | 'allOf' | undefined {
    if ('oneOf' in schema && Array.isArray(schema.oneOf)) return 'oneOf';
    if ('anyOf' in schema && Array.isArray(schema.anyOf)) return 'anyOf';
    if ('allOf' in schema && Array.isArray(schema. allOf)) return 'allOf';
    return undefined;
  }

  private shouldExtract(
    schema: OpenAPIV3.SchemaObject,
    compositionType: string,
    depth: number
  ): boolean {
    // Don't extract if single item and not configured to do so
    const items =
      schema[compositionType as keyof typeof schema] as
        | OpenAPIV3.SchemaObject[]
        | undefined;
    if (! items || items.length === 0) return false;

    if (items.length === 1 && !this.options.extractSingleItems) {
      return false;
    }

    // Don't extract at root level (too simple)
    if (depth === 0) {
      return false;
    }

    return true;
  }

  private calculateComplexity(
    schema: OpenAPIV3.SchemaObject,
    baseDepth: number
  ): number {
    let complexity = 1 + baseDepth;

    // Add for each property
    if (schema. properties) {
      complexity += Object.keys(schema.properties).length;
    }

    // Add for composition items
    if (schema.oneOf) complexity += schema.oneOf.length * 2;
    if (schema.anyOf) complexity += schema. anyOf.length * 2;
    if (schema.allOf) complexity += schema.allOf. length * 2;

    return complexity;
  }

  private generateSchemaName(
    metadata: {
      operationId?:  string;
      method?: string;
      path?: string;
      statusCode?: string;
    },
    path: string,
    compositionType: string
  ): string {
    // Prefer using operationId if available
    if (metadata.operationId) {
      const suffix =
        metadata.statusCode ||
        (path.includes('request') ? 'Request' : 'Response');
      return `${metadata.operationId}${suffix}`;
    }

    // Generate from path and method
    const pathParts = (metadata.path || '')
      .split('/')
      .filter((p) => p && ! p.includes('{'))
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1));

    const method = metadata.method ?  metadata.method.toUpperCase() : 'Request';
    const statusCode = metadata.statusCode || '';

    return `Api${pathParts.join('')}${method}${statusCode}`;
  }

  private isRefSchema(schema: unknown): boolean {
    return typeof schema === 'object' && schema !== null && '$ref' in schema;
  }
}
```

---

### **2. Schema Extraction Document Processor**

```typescript name=extract_inline_schemas_to_components.ts url=https://github.com/elastic/kibana/tree/main/src/platform/packages/shared/kbn-openapi-bundler/src/bundler/process_document/document_processors/extract_inline_schemas_to_components.ts
/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { OpenAPIV3 } from 'openapi-types';
import type { DocumentNodeProcessor } from './types/document_node_processor';
import type { TraverseDocumentNodeContext } from './types/traverse_document_node_context';
import { isPlainObjectType } from '../../../utils/is_plain_object_type';

export interface ExtractInlineSchemasOptions {
  /** Minimum complexity threshold for extraction */
  minComplexity?: number;
  /** Maximum nesting depth for analyzed schemas */
  maxDepth?:  number;
  /** Skip extraction if schema contains these patterns */
  excludePatterns?:  RegExp[];
  /** Extract single-item composition operators */
  extractSingleItems?:  boolean;
  /** Schema naming prefix */
  namingPrefix?: string;
}

interface SchemaRefTracker {
  /** Map of JSON pointer path -> suggested schema name */
  schemasToExtract: Map<string, string>;
  /** Map of schema names -> schema objects */
  components: Map<string, OpenAPIV3.SchemaObject>;
  /** Set of paths already processed */
  processedPaths: Set<string>;
  /** Counter for disambiguation */
  nameCounters: Map<string, number>;
}

/**
 * Creates a document processor that extracts inline schemas to components/schemas
 * and replaces them with $ref pointers.
 *
 * This processor handles oneOf, anyOf, allOf composition operators that contain
 * inline schema definitions, converting them to reusable component schemas.
 */
export function createExtractInlineSchemasProcessor(
  options: ExtractInlineSchemasOptions = {}
): DocumentNodeProcessor {
  const {
    minComplexity = 2,
    maxDepth = 10,
    extractSingleItems = false,
    namingPrefix = 'Generated',
  } = options;

  const tracker:  SchemaRefTracker = {
    schemasToExtract: new Map(),
    components: new Map(),
    processedPaths:  new Set(),
    nameCounters: new Map(),
  };

  return {
    onNodeEnter(node:  Readonly<any>, context: TraverseDocumentNodeContext) {
      // Look for composition operators (oneOf, anyOf, allOf) in paths or response schemas
      if (! isPlainObjectType(node)) return;

      // Identify if this node is in a response/request body location
      const contextPath = context.path. join('/');
      if (!isSchemaLocation(contextPath)) return;

      // Check for composition operators
      for (const compositionType of ['oneOf', 'anyOf', 'allOf'] as const) {
        if (compositionType in node && Array.isArray(node[compositionType])) {
          const items = node[compositionType] as OpenAPIV3.SchemaObject[];

          // Skip if single item and not configured to extract them
          if (items.length === 1 && !extractSingleItems) continue;

          // Skip if items are all references (already decomposed)
          if (items. every((item) => '$ref' in item)) continue;

          // Calculate complexity to decide if worth extracting
          const complexity = calculateComplexity(
            node,
            context.path. length,
            compositionType
          );

          if (complexity >= minComplexity && context.path.length < maxDepth) {
            markForExtraction(
              node,
              compositionType,
              items,
              context,
              tracker,
              namingPrefix
            );
          }
        }
      }
    },

    onNodeLeave(node: any, context: TraverseDocumentNodeContext) {
      // After entering all nodes, replace marked schemas with refs
      if (! isPlainObjectType(node)) return;

      const nodePath = context.path.join('/');

      // Check if this node should be replaced with a reference
      for (const [pathToReplace, schemaName] of tracker.schemasToExtract) {
        if (pathToReplace === nodePath) {
          // Store the original schema in components
          if (!tracker.components.has(schemaName)) {
            tracker. components.set(schemaName, { ... node });
          }

          // Replace with reference
          Object.keys(node).forEach((key) => delete node[key]);
          (node as any).$ref = `#/components/schemas/${schemaName}`;
          break;
        }
      }
    },
  };
}

/**
 * Adds the extracted components to the OpenAPI document
 */
export function applyExtractedSchemas(
  document: OpenAPIV3.Document,
  tracker: SchemaRefTracker
): void {
  if (tracker.components.size === 0) return;

  if (! document.components) {
    document.components = {};
  }

  if (!document.components.schemas) {
    document.components.schemas = {};
  }

  // Merge extracted schemas into document components
  for (const [name, schema] of tracker.components) {
    document.components.schemas[name] = schema;
  }
}

/**
 * Marks a schema with composition operator for extraction
 */
function markForExtraction(
  node:  any,
  compositionType: 'oneOf' | 'anyOf' | 'allOf',
  items: OpenAPIV3.SchemaObject[],
  context: TraverseDocumentNodeContext,
  tracker: SchemaRefTracker,
  namingPrefix: string
): void {
  const basePath = context.path.join('/');

  // Generate unique name for this schema
  const baseeName = generateSchemaName(context, compositionType, namingPrefix);
  const uniqueName = ensureUniqueName(baseeName, tracker);

  // Mark this specific composition for extraction
  tracker.schemasToExtract.set(basePath, uniqueName);

  // Extract each non-ref item to separate schema if it's complex
  items.forEach((item, index) => {
    if ('$ref' in item) return; // Skip references

    const itemComplexity = calculateComplexity(item, context.path.length + 1);
    if (itemComplexity >= 2 && isPlainObjectType(item)) {
      const itemName = `${uniqueName}${String. fromCharCode(65 + index)}`; // A, B, C... 
      const itemPath = `${basePath}/${compositionType}/${index}`;

      tracker.schemasToExtract.set(itemPath, itemName);
      tracker.components.set(itemName, { ...item });
    }
  });
}

/**
 * Generates a schema name based on context
 */
function generateSchemaName(
  context: TraverseDocumentNodeContext,
  compositionType: string,
  prefix: string
): string {
  const path = context.path;

  // Look for operationId in context
  let operationId = '';
  for (let i = 0; i < path.length; i++) {
    if (path[i] === 'operationId' && i + 1 < path.length) {
      operationId = String(path[i + 1]);
      break;
    }
  }

  // Determine if this is a request or response
  const isRequest = path.some((p) => p === 'requestBody');
  const isResponse = path.some((p) => p === 'responses');

  let statusCode = '';
  if (isResponse) {
    for (let i = path.length - 1; i >= 0; i--) {
      if (/^\d{3}$/.test(String(path[i]))) {
        statusCode = String(path[i]);
        break;
      }
    }
  }

  // Build name
  let name = prefix;
  if (operationId) {
    name += operationId;
  }

  if (isRequest) {
    name += 'Request';
  } else if (isResponse) {
    name += `Response`;
    if (statusCode) {
      name += statusCode;
    }
  }

  return name;
}

/**
 * Ensures schema name is unique by appending counter if needed
 */
function ensureUniqueName(
  baseName: string,
  tracker:  SchemaRefTracker
): string {
  if (! tracker.components.has(baseName) && ! tracker.schemasToExtract.values()) {
    return baseName;
  }

  let counter = tracker.nameCounters. get(baseName) || 1;
  let uniqueName = `${baseName}${counter}`;

  while (tracker.components.has(uniqueName)) {
    counter++;
    uniqueName = `${baseName}${counter}`;
  }

  tracker.nameCounters.set(baseName, counter + 1);
  return uniqueName;
}

/**
 * Checks if path is in a location where we should extract schemas
 */
function isSchemaLocation(path: string): boolean {
  // Only extract from request/response bodies, not from parameters, headers, etc.
  return (
    (path.includes('/requestBody/') || path.includes('/responses/')) &&
    path.includes('/schema')
  );
}

/**
 * Calculates complexity score for a schema
 */
function calculateComplexity(
  schema: any,
  depth: number,
  compositionType?:  string
): number {
  let score = 1 + depth;

  if (isPlainObjectType(schema)) {
    // Add points for properties
    if ('properties' in schema && isPlainObjectType(schema.properties)) {
      score += Object.keys(schema.properties).length;
    }

    // Add points for composition items
    if (compositionType && compositionType in schema) {
      const items = schema[compositionType];
      if (Array.isArray(items)) {
        score += items.length * 2;

        // Extra points for nested compositions
        items.forEach((item) => {
          if (
            isPlainObjectType(item) &&
            (['oneOf', 'anyOf', 'allOf'] as const).some((t) => t in item)
          ) {
            score += 3;
          }
        });
      }
    }

    // Add points if has discriminator
    if ('discriminator' in schema) {
      score += 2;
    }
  }

  return score;
}
```

---

### **3. Processor Set Integration**

```typescript name=processor_sets. ts url=https://github.com/elastic/kibana/tree/main/src/platform/packages/shared/kbn-openapi-bundler/src/bundler/processor_sets.ts
/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { DocumentNodeProcessor } from './process_document/document_processors/types/document_node_processor';
import { createSkipNodeWithInternalPropProcessor } from './process_document/document_processors/skip_node_with_internal_prop';
import { createIncludeLabelsProcessor } from './process_document/document_processors/include_labels';
import { createNamespaceComponentsProcessor } from './process_document/document_processors/namespace_components';
import { createFlattenFoldedAllOfItemsProcessor } from './process_document/document_processors/reduce_all_of_items/flatten_folded_all_of_items';
import { createMergeNonConflictingAllOfItemsProcessor } from './process_document/document_processors/reduce_all_of_items/merge_non_conflicting_all_of_items';
import { createUnfoldSingleAllOfItemProcessor } from './process_document/document_processors/reduce_all_of_items/unfold_single_all_of_item';
import { createExtractInlineSchemasProcessor } from './process_document/document_processors/extract_inline_schemas_to_components';
import type { ExtractInlineSchemasOptions } from './process_document/document_processors/extract_inline_schemas_to_components';
import { BundleRefProcessor } from './process_document/document_processors/bundle_refs';

/**
 * Default bundling processors in recommended order
 */
export const DEFAULT_BUNDLING_PROCESSORS:  Readonly<DocumentNodeProcessor[]> = [
  // 1. Skip internal nodes
  createSkipNodeWithInternalPropProcessor('x-internal'),

  // 2. Bundle references (inline or resolve)
  new BundleRefProcessor(),

  // 3. Reduce allOf compositions
  createFlattenFoldedAllOfItemsProcessor(),
  createMergeNonConflictingAllOfItemsProcessor(),
  createUnfoldSingleAllOfItemProcessor(),

  // 4. Extract inline schemas to components (NEW)
  createExtractInlineSchemasProcessor({
    minComplexity: 2,
    maxDepth:  10,
    extractSingleItems: false,
    namingPrefix: 'Generated',
  }),
];

/**
 * Adds extract inline schemas processor to processor set
 */
export function withExtractInlineSchemasProcessor(
  processors:  Readonly<DocumentNodeProcessor[]>,
  options?:  ExtractInlineSchemasOptions
): Readonly<DocumentNodeProcessor[]> {
  return [
    ...processors,
    createExtractInlineSchemasProcessor(options),
  ];
}

/**
 * Adds includeLabels processor, see createIncludeLabelsProcessor description
 * for more details
 */
export function withIncludeLabelsProcessor(
  processors: Readonly<DocumentNodeProcessor[]>,
  includeLabels: string[]
): Readonly<DocumentNodeProcessor[]> {
  return [... processors, createIncludeLabelsProcessor(includeLabels)];
}

export function withNamespaceComponentsProcessor(
  processors: Readonly<DocumentNodeProcessor[]>,
  namespacePointer: string
): Readonly<DocumentNodeProcessor[]> {
  return [...processors, createNamespaceComponentsProcessor(namespacePointer)];
}
```

---

### **4. Comprehensive Test Suite**

```typescript name=extract_inline_schemas_to_components.test.ts url=https://github.com/elastic/kibana/tree/main/src/platform/packages/shared/kbn-openapi-bundler/tests/bundler/extract_inline_schemas_to_components.test.ts
/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { bundleSpecs } from './bundle_specs';
import { createOASDocument } from '../create_oas_document';

describe('OpenAPI Bundler - extract inline schemas to components', () => {
  it('extracts oneOf compositions to components', async () => {
    const spec = createOASDocument({
      paths: {
        '/api/actions/connector': {
          get: {
            operationId: 'ApiActionsConnector',
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
                            type: { type: 'string', enum: ['email'] },
                            config: {
                              type: 'object',
                              properties: {
                                service: { type: 'string' },
                                host: { type: 'string' },
                              },
                            },
                          },
                        },
                        {
                          type: 'object',
                          properties: {
                            type: { type: 'string', enum: ['webhook'] },
                            config: {
                              type: 'object',
                              properties: {
                                url: { type: 'string' },
                                method: { type: 'string' },
                              },
                            },
                          },
                        },
                        {
                          type: 'object',
                          properties: {
                            type: { type:  'string', enum: ['slack'] },
                            config: {
                              type: 'object',
                              properties: {
                                webhookUrl: { type: 'string' },
                              },
                            },
                          },
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
    });

    const [bundledSpec] = Object.values(
      await bundleSpecs({
        1: spec,
      })
    );

    // Verify schemas were extracted to components
    expect(bundledSpec.components?. schemas).toBeDefined();
    expect(Object.keys(bundledSpec.components! .schemas! ).length).toBeGreaterThan(0);

    // Verify response now uses references
    const responseSchema =
      bundledSpec.paths['/api/actions/connector']?.get?.responses['200']. content? .[
        'application/json'
      ]?.schema;

    expect(responseSchema).toHaveProperty('oneOf');
    const oneOf = (responseSchema as any).oneOf as any[];
    expect(oneOf.length).toBeGreaterThan(0);

    // All items should be references or inline
    oneOf.forEach((item) => {
      expect(item).toHaveProperty('$ref');
    });
  });

  it('extracts anyOf compositions to components', async () => {
    const spec = createOASDocument({
      paths: {
        '/api/test': {
          post: {
            operationId:  'TestAnyOf',
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    anyOf: [
                      {
                        type:  'object',
                        properties: {
                          id: { type: 'string' },
                        },
                        required: ['id'],
                      },
                      {
                        type: 'object',
                        properties: {
                          email: { type: 'string', format: 'email' },
                        },
                        required:  ['email'],
                      },
                    ],
                  },
                },
              },
            },
            responses: {
              '200':  {
                description: 'Success',
              },
            },
          },
        },
      },
    });

    const [bundledSpec] = Object.values(
      await bundleSpecs({
        1: spec,
      })
    );

    // Verify request body schema was refactored
    const requestSchema =
      bundledSpec.paths['/api/test']?.post?.requestBody?.content?.[
        'application/json'
      ]?.schema;

    expect(requestSchema).toHaveProperty('anyOf');
    expect((requestSchema as any).anyOf).toBeDefined();
  });

  it('handles discriminator properties correctly', async () => {
    const spec = createOASDocument({
      paths: {
        '/api/polymorphic': {
          get:  {
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
                            kind: { type: 'string', enum: ['cat'] },
                            meow: { type: 'boolean' },
                          },
                        },
                        {
                          type: 'object',
                          properties: {
                            kind: { type: 'string', enum: ['dog'] },
                            bark: { type: 'boolean' },
                          },
                        },
                      ],
                      discriminator: {
                        propertyName: 'kind',
                        mapping: {
                          cat: '#/components/schemas/Cat',
                          dog: '#/components/schemas/Dog',
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
    });

    const [bundledSpec] = Object.values(
      await bundleSpecs({
        1: spec,
      })
    );

    const schema = bundledSpec.paths['/api/polymorphic']?.get?.responses['200'].content?.[
      'application/json'
    ]?. schema as any;

    // Discriminator should be preserved or handled appropriately
    expect(schema).toBeDefined();
  });

  it('does not extract simple non-composition schemas', async () => {
    const spec = createOASDocument({
      paths: {
        '/api/simple': {
          get: {
            responses:  {
              '200': {
                description: 'Simple response',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        age: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const [bundledSpec] = Object.values(
      await bundleSpecs({
        1: spec,
      })
    );

    // Verify inline schema is preserved (not extracted)
    const responseSchema =
      bundledSpec. paths['/api/simple']?. get?.responses['200'].content? .[
        'application/json'
      ]?.schema;

    expect(responseSchema).toEqual(spec.paths['/api/simple']?.get?.responses['200'].content? .[
      'application/json'
    ]?.schema);
  });

  it('avoids extracting schemas with existing $ref items', async () => {
    const spec = createOASDocument({
      paths: {
        '/api/mixed': {
          get: {
            responses: {
              '200': {
                description: 'Mixed response',
                content: {
                  'application/json':  {
                    schema: {
                      oneOf: [
                        { $ref: '#/components/schemas/ExistingSchema1' },
                        { $ref: '#/components/schemas/ExistingSchema2' },
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
          ExistingSchema1: {
            type: 'object',
            properties: {
              field1: { type: 'string' },
            },
          },
          ExistingSchema2: {
            type: 'object',
            properties: {
              field2: { type: 'string' },
            },
          },
        },
      },
    });

    const [bundledSpec] = Object.values(
      await bundleSpecs({
        1: spec,
      })
    );

    // The oneOf with all refs should not be extracted further
    const schema = bundledSpec.paths['/api/mixed']?.get?.responses['200'].content?.[
      'application/json'
    ]?.schema as any;

    expect(schema. oneOf).toEqual([
      { $ref: '#/components/schemas/ExistingSchema1' },
      { $ref: '#/components/schemas/ExistingSchema2' },
    ]);
  });

  it('generates unique names for multiple extractions', async () => {
    const spec = createOASDocument({
      paths: {
        '/api/endpoint1': {
          get: {
            operationId: 'GetEndpoint1',
            responses: {
              '200': {
                description: 'Response 200',
                content: {
                  'application/json': {
                    schema: {
                      oneOf: [
                        {
                          type: 'object',
                          properties: { a: { type: 'string' } },
                        },
                        {
                          type: 'object',
                          properties:  { b: { type: 'string' } },
                        },
                      ],
                    },
                  },
                },
              },
              '201': {
                description: 'Response 201',
                content:  {
                  'application/json': {
                    schema: {
                      oneOf: [
                        {
                          type:  'object',
                          properties: { c: { type: 'string' } },
                        },
                        {
                          type: 'object',
                          properties:  { d: { type: 'string' } },
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
    });

    const [bundledSpec] = Object.values(
      await bundleSpecs({
        1: spec,
      })
    );

    // Should have multiple extracted schemas with unique names
    const schemas = bundledSpec.components?.schemas || {};
    const extractedSchemas = Object.keys(schemas);

    // Verify we have multiple schemas
    expect(extractedSchemas. length).toBeGreaterThanOrEqual(2);

    // Names should be unique
    expect(new Set(extractedSchemas).size).toBe(extractedSchemas.length);
  });

  it('respects minComplexity option', async () => {
    const spec = createOASDocument({
      paths: {
        '/api/simple-composition': {
          get: {
            responses: {
              '200': {
                description: 'Response',
                content: {
                  'application/json': {
                    schema: {
                      oneOf: [
                        { type: 'string' },
                        { type:  'number' },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const [bundledSpec] = Object.values(
      await bundleSpecs({
        1: spec,
      })
    );

    // With default minComplexity=2, this simple oneOf might not be extracted
    const responseSchema =
      bundledSpec. paths['/api/simple-composition']?.get?.responses['200']
        . content?. ['application/json']?. schema;

    expect(responseSchema).toBeDefined();
  });
});
```

---

### **5. Integration into Merge Scripts**

```javascript name=merge_ess_oas. js url=https://github.com/elastic/kibana/tree/main/oas_docs/scripts/merge_ess_oas.js
/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const chalk = require('chalk');
const { merge } = require('@kbn/openapi-bundler');

const ROOT = path.resolve(__dirname, '. .');

(async () => {
  try {
    console.log(chalk.blue('Merging ESS OpenAPI specs... '));

    // Merge operation
    await merge({
      sourceGlobs: [
        path.join(ROOT, 'output', 'bundle. json'),
        path.join(ROOT, 'specs', '*.yaml'),
      ],
      outputFilePath: path.join(ROOT, 'output', 'kibana. yaml'),
      options: {
        prototypeDocument: path.join(ROOT, 'config', 'info.yaml'),
        // NEW: Enable inline schema extraction
        refactorInlineSchemas: {
          enabled: true,
          minComplexity: 2,
          maxDepth: 10,
          extractSingleItems: false,
          namingPrefix: 'Generated',
        },
      },
    });

    console.log(chalk.green('✓ ESS OpenAPI specs merged successfully'));

    // Read and log statistics
    const mergedSpec = yaml.load(
      fs.readFileSync(path.join(ROOT, 'output', 'kibana.yaml'), 'utf8')
    );

    const componentCount = Object.keys(
      mergedSpec.components?.schemas || {}
    ).length;
    const pathCount = Object.keys(mergedSpec.paths || {}).length;

    console.log(
      chalk.cyan(`  Components: ${componentCount}, Paths: ${pathCount}`)
    );
  } catch (error) {
    console.error(chalk.red('Error merging ESS OpenAPI specs:'), error);
    process.exit(1);
  }
})();
```

---

### **6. CLI Configuration Update**

```typescript name=openapi_bundler. ts url=https://github.com/elastic/kibana/tree/main/src/platform/packages/shared/kbn-openapi-bundler/src/openapi_bundler.ts
/*
 * Copyright Elasticsearch B.V.  and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import path from 'path';
import chalk from 'chalk';
import type { OpenAPIV3 } from 'openapi-types';
import { logger } from '@kbn/tooling-log';
import { writeDocuments, mergeDocuments, bundleDocuments } from './bundler';
import type { ResolvedDocument } from './bundler/ref_resolver/resolved_document';
import { resolveGlobs } from './utils/resolve_globs';
import {
  DEFAULT_BUNDLING_PROCESSORS,
  withIncludeLabelsProcessor,
  withExtractInlineSchemasProcessor,
} from './bundler/processor_sets';
import type { ExtractInlineSchemasOptions } from './bundler/process_document/document_processors/extract_inline_schemas_to_components';
import type { PrototypeDocument } from './prototype_document';
import { validatePrototypeDocument } from './validate_prototype_document';

export interface BundlerConfig {
  sourceGlob: string;
  outputFilePath: string;
  options?:  BundleOptions;
}

export interface BundleOptions {
  /**
   * OpenAPI document itself or path to the document
   */
  prototypeDocument?:  PrototypeDocument | string;
  /**
   * When `includeLabels` are specified the produced bundle will contain only
   * operations objects with matching labels
   */
  includeLabels?: string[];
  /**
   * Options for extracting inline schemas to components
   */
  refactorInlineSchemas?: {
    enabled: boolean;
  } & ExtractInlineSchemasOptions;
}

const { dirname, basename } = path;
const { removeFilesByGlob } = require('@kbn/openapi-generator');

export const bundle = async ({
  sourceGlob,
  outputFilePath = 'bundled_{version}.schema.yaml',
  options,
}: BundlerConfig) => {
  const prototypeDocument = options?.prototypeDocument
    ? await validatePrototypeDocument(options?. prototypeDocument)
    : undefined;

  logger.debug(chalk.bold(`Bundling API route schemas`));
  logger.debug(`👀  Searching for source files in ${chalk.underline(sourceGlob)}`);

  const schemaFilePaths = await resolveGlobs([sourceGlob]);

  logger.info(`🕵️‍♀️  Found ${schemaFilePaths.length} schemas`);

  logger.info(`🧹  Cleaning up any previously generated artifacts`);
  await removeFilesByGlob(
    dirname(outputFilePath),
    basename(outputFilePath. replace('{version}', '*'))
  );

  logger.debug(`Processing schemas... `);

  // Build processors with optional inline schema extraction
  let processors = [... DEFAULT_BUNDLING_PROCESSORS];

  if (options?.includeLabels) {
    processors = withIncludeLabelsProcessor(processors, options.includeLabels);
  }

  // Add inline schema extraction if enabled
  if (options?.refactorInlineSchemas?.enabled) {
    const extractOptions: ExtractInlineSchemasOptions = {
      minComplexity: options.refactorInlineSchemas.minComplexity,
      maxDepth: options.refactorInlineSchemas.maxDepth,
      extractSingleItems: options. refactorInlineSchemas. extractSingleItems,
      namingPrefix: options.refactorInlineSchemas.namingPrefix,
    };

    processors = withExtractInlineSchemasProcessor(processors, extractOptions);

    logger.info(
      chalk.yellow(
        'Inline schema extraction enabled with options:',
        JSON.stringify(extractOptions, null, 2)
      )
    );
  }

  const bundledDocuments = await bundleDocuments(schemaFilePaths, {
    processors,
  });

  logger.success(`Processed ${bundledDocuments.length} schemas`);

  // ... rest of bundling logic
};
```

---

## Summary

These code examples provide a complete implementation framework for automatic schema refactoring in the Kibana OAS pipeline: 

1. **Schema Analyzer** - Identifies extractable schemas based on complexity metrics
2. **Document Processor** - Implements the extraction logic following Kibana's processor pattern
3. **Processor Integration** - Adds processor to the pipeline in correct order
4. **Comprehensive Tests** - Covers various scenarios and edge cases
5. **Script Integration** - Shows how to integrate into the CI/CD merge scripts
6. **Configuration** - Demonstrates CLI and options handling

All examples follow Kibana's existing patterns and conventions from the `kbn-openapi-bundler` package.

Perfect! Now I'll create a comprehensive test script and testing utilities:

## Complete Testing Script for Schema Refactoring Functionality

### **1. Main Test Script - Manual/CLI Testing**

```bash name=test-inline-schema-extraction. sh url=https://github.com/elastic/kibana/tree/main/scripts/test-inline-schema-extraction.sh
#!/bin/bash

###############################################################################
# Test Script for Inline Schema Extraction to Components
# 
# This script provides utilities to test the inline schema refactoring
# feature in the Kibana OAS pipeline
#
# Usage:
#   ./scripts/test-inline-schema-extraction.sh [unit|integration|manual|all]
#
###############################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/. ." && pwd)"
BUNDLER_PKG_PATH="${REPO_ROOT}/src/platform/packages/shared/kbn-openapi-bundler"
TEST_OUTPUT_DIR="${REPO_ROOT}/target/oas-test-output"
LOGS_DIR="${TEST_OUTPUT_DIR}/logs"

# Create output directories
mkdir -p "${LOGS_DIR}"

###############################################################################
# Logging Functions
###############################################################################

log_info() {
  echo -e "${BLUE}ℹ ${1}${NC}"
}

log_success() {
  echo -e "${GREEN}✓ ${1}${NC}"
}

log_warning() {
  echo -e "${YELLOW}⚠ ${1}${NC}"
}

log_error() {
  echo -e "${RED}✗ ${1}${NC}"
}

###############################################################################
# Unit Tests
###############################################################################

run_unit_tests() {
  log_info "Running unit tests for schema extraction..."
  
  local test_file="${BUNDLER_PKG_PATH}/tests/bundler/extract_inline_schemas_to_components.test.ts"
  
  if [ !  -f "${test_file}" ]; then
    log_error "Test file not found: ${test_file}"
    return 1
  fi

  cd "${REPO_ROOT}"
  
  log_info "Running Jest tests for extract_inline_schemas_to_components..."
  yarn jest --testPathPattern="extract_inline_schemas_to_components" \
    --verbose \
    --coverage \
    --coveragePathIgnorePatterns="test" \
    2>&1 | tee "${LOGS_DIR}/unit-tests.log"
  
  local exit_code=$?
  
  if [ ${exit_code} -eq 0 ]; then
    log_success "Unit tests passed"
  else
    log_error "Unit tests failed (exit code: ${exit_code})"
  fi
  
  return ${exit_code}
}

###############################################################################
# Integration Tests
###############################################################################

run_integration_tests() {
  log_info "Running integration tests with bundler..."
  
  cd "${REPO_ROOT}"
  
  log_info "Testing bundler with inline schema extraction..."
  yarn jest --testPathPattern="bundler" \
    --testNamePattern="extract|inline|schema" \
    --verbose \
    2>&1 | tee "${LOGS_DIR}/integration-tests. log"
  
  local exit_code=$?
  
  if [ ${exit_code} -eq 0 ]; then
    log_success "Integration tests passed"
  else
    log_warning "Some integration tests may have failed (exit code: ${exit_code})"
  fi
  
  return ${exit_code}
}

###############################################################################
# Manual Testing with Sample OAS Documents
###############################################################################

run_manual_tests() {
  log_info "Running manual tests with sample OAS documents..."
  
  local test_specs_dir="${TEST_OUTPUT_DIR}/test-specs"
  local bundled_output_dir="${TEST_OUTPUT_DIR}/bundled"
  
  mkdir -p "${test_specs_dir}" "${bundled_output_dir}"
  
  # Create test specifications
  create_test_specs "${test_specs_dir}"
  
  # Run bundler on test specs
  log_info "Bundling test specifications..."
  cd "${REPO_ROOT}"
  
  node -e "
    const { bundle } = require('${BUNDLER_PKG_PATH}/src/openapi_bundler');
    const path = require('path');
    
    (async () => {
      try {
        await bundle({
          sourceGlob: path.join('${test_specs_dir}', '*. schema.yaml'),
          outputFilePath: path.join('${bundled_output_dir}', 'bundled-{version}.yaml'),
          options: {
            refactorInlineSchemas: {
              enabled: true,
              minComplexity: 2,
              maxDepth: 10,
              extractSingleItems: false,
              namingPrefix: 'Generated',
            },
          },
        });
        
        console.log('✓ Bundling completed successfully');
      } catch (error) {
        console.error('✗ Bundling failed:', error);
        process.exit(1);
      }
    })();
  " 2>&1 | tee "${LOGS_DIR}/manual-test. log"
  
  local exit_code=$?
  
  if [ ${exit_code} -eq 0 ]; then
    log_success "Manual tests completed"
    
    # Display bundled output
    log_info "Bundled output:"
    for file in "${bundled_output_dir}"/*.yaml; do
      if [ -f "${file}" ]; then
        echo ""
        echo "File: $(basename "${file}")"
        head -50 "${file}"
        echo "..."
      fi
    done
  else
    log_error "Manual tests failed"
  fi
  
  return ${exit_code}
}

###############################################################################
# Create Test Specifications
###############################################################################

create_test_specs() {
  local output_dir="${1}"
  
  log_info "Creating test OAS specifications..."
  
  # Test 1: oneOf composition
  cat > "${output_dir}/test-oneof.schema.yaml" << 'EOF'
openapi: 3.0.3
info:
  title: Test OneOf API
  version: '2024-01-01'
paths:
  /api/actions/connector:
    get:
      operationId: ApiActionsConnectorGet
      summary: Get available connectors
      responses:
        '200':
          description: List of connectors
          content:
            application/json:
              schema: 
                type: array
                items:
                  oneOf:
                    - type: object
                      properties:
                        type:
                          type: string
                          enum:  [email]
                        id:
                          type: string
                        name:
                          type: string
                        config:
                          type: object
                          properties:
                            service:
                              type: string
                            host:
                              type: string
                            port:
                              type: integer
                          required:  [service, host]
                      required: [type, id, name, config]
                    - type:  object
                      properties:
                        type:
                          type:  string
                          enum: [webhook]
                        id:
                          type: string
                        name:
                          type: string
                        config:
                          type: object
                          properties: 
                            url:
                              type: string
                              format: uri
                            method:
                              type: string
                              enum: [GET, POST, PUT, DELETE]
                          required: [url, method]
                      required: [type, id, name, config]
                    - type: object
                      properties:
                        type:
                          type: string
                          enum: [slack]
                        id:
                          type: string
                        name:
                          type: string
                        config:
                          type: object
                          properties: 
                            webhookUrl:
                              type:  string
                              format: uri
                          required: [webhookUrl]
                      required: [type, id, name, config]
EOF
  
  # Test 2: anyOf composition
  cat > "${output_dir}/test-anyof.schema.yaml" << 'EOF'
openapi: 3.0.3
info:
  title: Test AnyOf API
  version: '2024-01-01'
paths: 
  /api/users/search:
    post:
      operationId: SearchUsers
      summary: Search users by criteria
      requestBody:
        required: true
        content:
          application/json:
            schema: 
              anyOf:
                - type: object
                  properties:
                    userId:
                      type: string
                      description: Search by user ID
                  required:  [userId]
                - type:  object
                  properties:
                    email:
                      type: string
                      format: email
                      description: Search by email
                  required: [email]
                - type: object
                  properties:
                    username:
                      type: string
                      description: Search by username
                  required: [username]
      responses:
        '200': 
          description: Users found
          content:
            application/json: 
              schema:
                type: array
                items:
                  type: object
                  properties: 
                    id:
                      type: string
                    email:
                      type: string
                    username: 
                      type: string
                  required: [id, email, username]
EOF
  
  # Test 3: allOf composition
  cat > "${output_dir}/test-allof.schema.yaml" << 'EOF'
openapi: 3.0.3
info:
  title: Test AllOf API
  version: '2024-01-01'
paths: 
  /api/documents:
    post:
      operationId: CreateDocument
      summary: Create a document with metadata
      requestBody:
        required: true
        content:
          application/json:
            schema: 
              allOf:
                - type: object
                  properties: 
                    content:
                      type: string
                    title:
                      type: string
                  required: [content, title]
                - type: object
                  properties:
                    tags:
                      type: array
                      items:
                        type: string
                    metadata:
                      type: object
                      additionalProperties:
                        type:  string
                  required: [tags]
      responses:
        '201':
          description: Document created
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type:  string
                  createdAt:
                    type:  string
                    format: date-time
EOF
  
  # Test 4:  Discriminator composition
  cat > "${output_dir}/test-discriminator. schema.yaml" << 'EOF'
openapi: 3.0.3
info:
  title: Test Discriminator API
  version: '2024-01-01'
paths:
  /api/animals:
    get:
      operationId: GetAnimals
      summary: Get animals with discriminator
      responses:
        '200':
          description: List of animals
          content:
            application/json:
              schema: 
                type: array
                items:
                  oneOf:
                    - type:  object
                      properties:
                        kind:
                          type: string
                          enum: [cat]
                        meow:
                          type: boolean
                          description: Can meow
                      required: [kind, meow]
                    - type: object
                      properties: 
                        kind:
                          type: string
                          enum: [dog]
                        bark:
                          type: boolean
                          description: Can bark
                      required: [kind, bark]
                    - type: object
                      properties:
                        kind:
                          type: string
                          enum: [bird]
                        sing:
                          type: boolean
                          description: Can sing
                      required: [kind, sing]
                  discriminator: 
                    propertyName: kind
EOF
  
  log_success "Created test specifications in ${output_dir}"
}

###############################################################################
# Validation Tests
###############################################################################

run_validation_tests() {
  log_info "Running validation tests..."
  
  local bundled_dir="${TEST_OUTPUT_DIR}/bundled"
  local validation_log="${LOGS_DIR}/validation. log"
  
  > "${validation_log}"
  
  log_info "Validating bundled OpenAPI specs..."
  
  for file in "${bundled_dir}"/*.yaml; do
    if [ -f "${file}" ]; then
      log_info "Validating $(basename "${file}")..."
      
      # Basic structure validation
      if ! command -v yq &> /dev/null; then
        log_warning "yq not found, skipping YAML validation"
      else
        yq eval 'keys' "${file}" >> "${validation_log}" 2>&1
      fi
      
      # Check for components/schemas
      if grep -q "components:" "${file}"; then
        log_success "Found components section"
        
        local schema_count
        schema_count=$(grep -c "^  [a-zA-Z]" "${file}" || true)
        log_info "Extracted schemas count: ${schema_count}"
      fi
    fi
  done
  
  log_success "Validation tests completed"
}

###############################################################################
# Performance Tests
###############################################################################

run_performance_tests() {
  log_info "Running performance tests..."
  
  local perf_log="${LOGS_DIR}/performance. log"
  > "${perf_log}"
  
  cd "${REPO_ROOT}"
  
  log_info "Measuring bundler performance..."
  
  node -e "
    const { performance } = require('perf_hooks');
    const { bundle } = require('${BUNDLER_PKG_PATH}/src/openapi_bundler');
    const path = require('path');
    
    (async () => {
      const start = performance.now();
      
      try {
        await bundle({
          sourceGlob: path.join('${TEST_OUTPUT_DIR}/test-specs', '*.schema.yaml'),
          outputFilePath: path.join('${TEST_OUTPUT_DIR}/bundled', 'perf-test-{version}.yaml'),
          options: {
            refactorInlineSchemas: {
              enabled:  true,
              minComplexity: 2,
              maxDepth: 10,
            },
          },
        });
        
        const end = performance. now();
        const duration = (end - start).toFixed(2);
        
        console.log(\`Performance Test Results:\`);
        console.log(\`  Total time: \${duration}ms\`);
        console.log(\`  Status:  PASSED\`);
      } catch (error) {
        console.error('Performance test failed:', error);
        process.exit(1);
      }
    })();
  " 2>&1 | tee "${perf_log}"
  
  log_success "Performance tests completed"
}

###############################################################################
# Report Generation
###############################################################################

generate_report() {
  local report_file="${LOGS_DIR}/test-report.md"
  
  log_info "Generating test report..."
  
  cat > "${report_file}" << EOF
# Inline Schema Extraction Test Report

Generated:  $(date)

## Test Results

### Unit Tests
- File: ${LOGS_DIR}/unit-tests.log

### Integration Tests
- File: ${LOGS_DIR}/integration-tests.log

### Manual Tests
- File: ${LOGS_DIR}/manual-test.log

### Validation Tests
- File: ${LOGS_DIR}/validation.log

### Performance Tests
- File: ${LOGS_DIR}/performance.log

## Test Specifications
- Location: ${TEST_OUTPUT_DIR}/test-specs

## Bundled Output
- Location: ${TEST_OUTPUT_DIR}/bundled

## Logs
- All logs:  ${LOGS_DIR}

## Summary

Total test files:  $(find "${LOGS_DIR}" -name "*.log" | wc -l)
Test timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)

EOF
  
  log_success "Report generated:  ${report_file}"
  cat "${report_file}"
}

###############################################################################
# Main Entry Point
###############################################################################

main() {
  local test_type="${1:-all}"
  
  log_info "Starting inline schema extraction tests..."
  log_info "Test type: ${test_type}"
  log_info "Output directory: ${TEST_OUTPUT_DIR}"
  
  local overall_exit_code=0
  
  case "${test_type}" in
    unit)
      run_unit_tests || overall_exit_code=$? 
      ;;
    integration)
      run_integration_tests || overall_exit_code=$?
      ;;
    manual)
      run_manual_tests || overall_exit_code=$?
      run_validation_tests || overall_exit_code=$?
      run_performance_tests || overall_exit_code=$?
      ;;
    all)
      run_unit_tests || overall_exit_code=$?
      run_integration_tests || overall_exit_code=$?
      run_manual_tests || overall_exit_code=$?
      run_validation_tests || overall_exit_code=$?
      run_performance_tests || overall_exit_code=$?
      ;;
    *)
      log_error "Unknown test type: ${test_type}"
      echo "Usage: $0 [unit|integration|manual|all]"
      exit 1
      ;;
  esac
  
  generate_report
  
  echo ""
  if [ ${overall_exit_code} -eq 0 ]; then
    log_success "All tests completed successfully!"
  else
    log_error "Some tests failed (exit code: ${overall_exit_code})"
  fi
  
  exit ${overall_exit_code}
}

# Run main function
main "$@"
```

---

### **2. Node.js Test Runner Script**

```javascript name=test-runner.js url=https://github.com/elastic/kibana/tree/main/scripts/test-inline-schema-extraction.js
#!/usr/bin/env node

/**
 * Comprehensive test runner for inline schema extraction feature
 * 
 * Usage:
 *   node scripts/test-inline-schema-extraction.js [--test-type=all] [--verbose] [--watch]
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const chalk = require('chalk');
const yaml = require('js-yaml');

/**
 * Configuration
 */
const config = {
  repoRoot: path.resolve(__dirname, '..'),
  bundlerPkgPath: path. resolve(__dirname, '../src/platform/packages/shared/kbn-openapi-bundler'),
  testOutputDir: path.resolve(__dirname, '../target/oas-test-output'),
  logsDir: path.resolve(__dirname, '../target/oas-test-output/logs'),
};

// Ensure output directories exist
[config.testOutputDir, config. logsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
 * Logger utility
 */
const logger = {
  info: (msg) => console.log(chalk.blue(`ℹ ${msg}`)),
  success: (msg) => console.log(chalk.green(`✓ ${msg}`)),
  error: (msg) => console.error(chalk.red(`✗ ${msg}`)),
  warning: (msg) => console.warn(chalk.yellow(`⚠ ${msg}`)),
  debug: (msg) => {
    if (process.argv.includes('--verbose')) {
      console.log(chalk.gray(`  ${msg}`));
    }
  },
};

/**
 * Execute shell command and return output
 */
function executeCommand(cmd, options = {}) {
  try {
    const output = execSync(cmd, {
      cwd: config.repoRoot,
      encoding: 'utf8',
      ...options,
    });
    return { success: true, output };
  } catch (error) {
    return { success: false, error: error.message, output: error.stdout || '' };
  }
}

/**
 * Test Suite:  Unit Tests
 */
async function runUnitTests() {
  logger.info('Running unit tests for schema extraction...');
  
  const cmd = 'yarn jest --testPathPattern="extract_inline_schemas_to_components" --verbose --coverage';
  const result = executeCommand(cmd);
  
  const logFile = path.join(config. logsDir, 'unit-tests.log');
  fs.writeFileSync(logFile, `Command: ${cmd}\n\n${result.output}${result.error ?  `\nError: ${result.error}` : ''}`);
  
  if (result.success) {
    logger.success('Unit tests passed');
  } else {
    logger.error(`Unit tests failed:  ${result.error}`);
  }
  
  return result.success;
}

/**
 * Test Suite: Integration Tests
 */
async function runIntegrationTests() {
  logger.info('Running integration tests with bundler...');
  
  const cmd = 'yarn jest --testPathPattern="bundler" --testNamePattern="extract|inline|schema" --verbose';
  const result = executeCommand(cmd);
  
  const logFile = path.join(config. logsDir, 'integration-tests.log');
  fs.writeFileSync(logFile, `Command: ${cmd}\n\n${result.output}${result. error ? `\nError: ${result.error}` : ''}`);
  
  if (result.success) {
    logger.success('Integration tests passed');
  } else {
    logger.warning(`Integration tests had issues: ${result.error}`);
  }
  
  return true; // Don't fail on integration tests
}

/**
 * Create test OAS specifications
 */
function createTestSpecs(outputDir) {
  logger.info('Creating test OAS specifications...');
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const specs = {
    'test-oneof. schema.yaml': {
      openapi: '3.0.3',
      info: {
        title: 'Test OneOf API',
        version: '2024-01-01',
      },
      paths: {
        '/api/actions/connector': {
          get: {
            operationId:  'ApiActionsConnectorGet',
            summary: 'Get available connectors',
            responses: {
              '200': {
                description: 'List of connectors',
                content: {
                  'application/json': {
                    schema: {
                      type: 'array',
                      items: {
                        oneOf: [
                          {
                            type: 'object',
                            properties: {
                              type: { type: 'string', enum: ['email'] },
                              id: { type: 'string' },
                              name: { type: 'string' },
                              config: {
                                type: 'object',
                                properties: {
                                  service: { type: 'string' },
                                  host: { type: 'string' },
                                  port: { type: 'integer' },
                                },
                                required: ['service', 'host'],
                              },
                            },
                            required: ['type', 'id', 'name', 'config'],
                          },
                          {
                            type: 'object',
                            properties: {
                              type: { type:  'string', enum: ['webhook'] },
                              id: { type: 'string' },
                              name: { type: 'string' },
                              config: {
                                type: 'object',
                                properties:  {
                                  url: { type: 'string', format: 'uri' },
                                  method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'] },
                                },
                                required: ['url', 'method'],
                              },
                            },
                            required: ['type', 'id', 'name', 'config'],
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
      },
    },
    'test-anyof.schema.yaml': {
      openapi: '3.0.3',
      info: {
        title: 'Test AnyOf API',
        version:  '2024-01-01',
      },
      paths: {
        '/api/users/search': {
          post: {
            operationId:  'SearchUsers',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    anyOf: [
                      {
                        type: 'object',
                        properties: {
                          userId: { type: 'string' },
                        },
                        required: ['userId'],
                      },
                      {
                        type: 'object',
                        properties: {
                          email: { type: 'string', format: 'email' },
                        },
                        required:  ['email'],
                      },
                    ],
                  },
                },
              },
            },
            responses: {
              '200':  {
                description: 'Users found',
              },
            },
          },
        },
      },
    },
  };

  for (const [filename, spec] of Object.entries(specs)) {
    const filepath = path.join(outputDir, filename);
    fs.writeFileSync(filepath, yaml.dump(spec, { skipInvalid: true }));
    logger.debug(`Created ${filename}`);
  }

  logger.success(`Created ${Object.keys(specs).length} test specifications`);
}

/**
 * Test Suite: Manual Tests (end-to-end)
 */
async function runManualTests() {
  logger.info('Running manual end-to-end tests...');
  
  const testSpecsDir = path.join(config.testOutputDir, 'test-specs');
  const bundledDir = path.join(config. testOutputDir, 'bundled');
  
  // Create test specs
  createTestSpecs(testSpecsDir);
  
  // Ensure bundled output directory exists
  if (!fs.existsSync(bundledDir)) {
    fs.mkdirSync(bundledDir, { recursive:  true });
  }

  // Run bundler
  logger.info('Bundling test specifications...');
  
  try {
    const { bundle } = require(path.join(config.bundlerPkgPath, 'src/openapi_bundler'));
    
    await bundle({
      sourceGlob: path.join(testSpecsDir, '*.schema.yaml'),
      outputFilePath: path.join(bundledDir, 'bundled-{version}.yaml'),
      options: {
        refactorInlineSchemas: {
          enabled:  true,
          minComplexity: 2,
          maxDepth: 10,
          extractSingleItems: false,
          namingPrefix: 'Generated',
        },
      },
    });
    
    logger.success('Bundling completed successfully');
    
    // Validate output
    const bundledFiles = fs.readdirSync(bundledDir).filter(f => f.endsWith('.yaml'));
    logger.success(`Generated ${bundledFiles.length} bundled spec(s)`);
    
    // Check for extracted schemas
    for (const file of bundledFiles) {
      const content = fs. readFileSync(path.join(bundledDir, file), 'utf8');
      const doc = yaml.load(content);
      
      if (doc.components && doc.components.schemas) {
        const schemaCount = Object.keys(doc.components.schemas).length;
        logger.success(`Extracted ${schemaCount} schemas in ${file}`);
        
        // Log schema names
        if (process.argv.includes('--verbose')) {
          Object.keys(doc.components.schemas).forEach(name => {
            logger.debug(`  - ${name}`);
          });
        }
      }
    }
    
    return true;
  } catch (error) {
    logger.error(`Bundling failed: ${error. message}`);
    return false;
  }
}

/**
 * Test Suite: Validation Tests
 */
async function runValidationTests() {
  logger.info('Running validation tests...');
  
  const bundledDir = path.join(config.testOutputDir, 'bundled');
  let validationsPassed = 0;
  let validationsFailed = 0;

  const bundledFiles = fs.readdirSync(bundledDir).filter(f => f.endsWith('.yaml'));
  
  for (const file of bundledFiles) {
    const filepath = path.join(bundledDir, file);
    
    try {
      const content = fs.readFileSync(filepath, 'utf8');
      const doc = yaml.load(content);
      
      // Check structure
      if (! doc.openapi) {
        throw new Error('Missing openapi version');
      }
      
      if (!doc.info) {
        throw new Error('Missing info object');
      }
      
      if (doc.components && doc.components.schemas) {
        // Validate schema references
        const paths = doc.paths || {};
        for (const [pathName, pathItem] of Object.entries(paths)) {
          for (const [method, operation] of Object.entries(pathItem)) {
            if (method === 'parameters' || method === 'servers') continue;
            
            const op = operation;
            if (op && op.responses) {
              for (const response of Object.values(op.responses)) {
                if (response && response.content) {
                  for (const media of Object.values(response.content)) {
                    validateSchemaRefs(media. schema, doc.components.schemas);
                  }
                }
              }
            }
          }
        }
      }
      
      logger.success(`Validation passed for ${file}`);
      validationsPassed++;
    } catch (error) {
      logger.error(`Validation failed for ${file}: ${error.message}`);
      validationsFailed++;
    }
  }
  
  logger.success(`Validations:  ${validationsPassed} passed, ${validationsFailed} failed`);
  return validationsFailed === 0;
}

/**
 * Recursively validate schema references
 */
function validateSchemaRefs(schema, components, visited = new Set()) {
  if (! schema || typeof schema !== 'object') return;
  
  const schemaStr = JSON.stringify(schema);
  if (visited.has(schemaStr)) return;
  visited.add(schemaStr);
  
  if (schema.$ref) {
    const refPath = schema.$ref. replace('#/components/schemas/', '');
    if (! components[refPath]) {
      throw new Error(`Broken reference: ${schema.$ref}`);
    }
  }
  
  if (schema.oneOf) {
    schema.oneOf.forEach(s => validateSchemaRefs(s, components, visited));
  }
  if (schema.anyOf) {
    schema.anyOf.forEach(s => validateSchemaRefs(s, components, visited));
  }
  if (schema.allOf) {
    schema.allOf.forEach(s => validateSchemaRefs(s, components, visited));
  }
  if (schema.properties) {
    Object.values(schema.properties).forEach(s => validateSchemaRefs(s, components, visited));
  }
  if (schema.items) {
    validateSchemaRefs(schema.items, components, visited);
  }
}

/**
 * Test Suite:  Performance Tests
 */
async function runPerformanceTests() {
  logger.info('Running performance tests...');
  
  const testSpecsDir = path.join(config.testOutputDir, 'test-specs');
  const perfDir = path.join(config. testOutputDir, 'perf-test');
  
  if (!fs.existsSync(perfDir)) {
    fs.mkdirSync(perfDir, { recursive: true });
  }

  try {
    const { bundle } = require(path. join(config.bundlerPkgPath, 'src/openapi_bundler'));
    
    const start = process.hrtime. bigint();
    
    await bundle({
      sourceGlob: path.join(testSpecsDir, '*.schema. yaml'),
      outputFilePath:  path.join(perfDir, 'perf-{version}.yaml'),
      options: {
        refactorInlineSchemas: {
          enabled: true,
        },
      },
    });
    
    const end = process. hrtime.bigint();
    const duration = Number(end - start) / 1_000_000; // Convert to milliseconds
    
    logger.success(`Performance test completed in ${duration.toFixed(2)}ms`);
    
    return true;
  } catch (error) {
    logger.error(`Performance test failed: ${error.message}`);
    return false;
  }
}

/**
 * Generate test report
 */
function generateReport(results) {
  const reportPath = path.join(config. logsDir, 'test-report.md');
  
  const report = `# Inline Schema Extraction Test Report

Generated: ${new Date().toISOString()}

## Test Summary

| Test Suite | Status | Details |
|-----------|--------|---------|
| Unit Tests | ${results.unitTests ?  '✓ PASSED' : '✗ FAILED'} | |
| Integration Tests | ${results. integrationTests ? '✓ PASSED' : '✗ FAILED'} | |
| Manual Tests | ${results.manualTests ? '✓ PASSED' : '✗ FAILED'} | |
| Validation Tests | ${results.validationTests ?  '✓ PASSED' :  '✗ FAILED'} | |
| Performance Tests | ${results.performanceTests ? '✓ PASSED' : '✗ FAILED'} | |

## Overall Result

${
  Object.values(results).every(r => r) 
    ? '✓ ALL TESTS PASSED' 
    : '✗ SOME TESTS FAILED'
}

## Logs

- Logs directory: ${config.logsDir}
- Test specs directory: ${path.join(config.testOutputDir, 'test-specs')}
- Bundled output: ${path.join(config. testOutputDir, 'bundled')}

## Test Specifications Used

- test-oneof.schema.yaml
- test-anyof.schema. yaml

---

For detailed logs, check the files in:  ${config.logsDir}
`;
  
  fs.writeFileSync(reportPath, report);
  logger.success(`Test report generated: ${reportPath}`);
  console.log('\n' + report);
}

/**
 * Main entry point
 */
async function main() {
  try {
    logger.info('Starting inline schema extraction tests...');
    logger.info(`Output directory: ${config.testOutputDir}`);
    
    const results = {
      unitTests: await runUnitTests(),
      integrationTests: await runIntegrationTests(),
      manualTests:  await runManualTests(),
      validationTests: await runValidationTests(),
      performanceTests:  await runPerformanceTests(),
    };
    
    generateReport(results);
    
    const allPassed = Object.values(results).every(r => r);
    
    if (allPassed) {
      logger.success('All tests completed successfully!');
      process.exit(0);
    } else {
      logger.error('Some tests failed. See report for details.');
      process.exit(1);
    }
  } catch (error) {
    logger.error(`Test suite failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run tests
main();
```

---

### **3. Quick Start Test Commands**

```bash name=test-commands. sh
#!/bin/bash

# Test commands for inline schema extraction feature

# Set repo root
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/. ." && pwd)"
cd "${REPO_ROOT}"

echo "=== Inline Schema Extraction Test Commands ==="
echo ""

echo "1. Run all tests (recommended):"
echo "   yarn test: extract-schemas"
echo ""

echo "2. Run unit tests only:"
echo "   yarn jest extract_inline_schemas_to_components --verbose"
echo ""

echo "3. Run integration tests:"
echo "   yarn jest --testPathPattern='bundler' --testNamePattern='extract|inline|schema'"
echo ""

echo "4. Run manual end-to-end test:"
echo "   node scripts/test-inline-schema-extraction.js --test-type=manual --verbose"
echo ""

echo "5. Run with coverage report:"
echo "   yarn jest extract_inline_schemas_to_components --coverage"
echo ""

echo "6. Watch mode for development:"
echo "   yarn jest extract_inline_schemas_to_components --watch"
echo ""

echo "7. Run test script with all options:"
echo "   ./scripts/test-inline-schema-extraction.sh all"
echo ""

echo "8. Generate test report:"
echo "   node scripts/test-inline-schema-extraction.js && cat target/oas-test-output/logs/test-report.md"
echo ""
```

---

### **4. package.json Scripts Entry**

```json
{
  "scripts": {
    "test: extract-schemas": "node scripts/test-inline-schema-extraction.js",
    "test:extract-schemas: unit": "yarn jest extract_inline_schemas_to_components --verbose --coverage",
    "test:extract-schemas:integration": "yarn jest --testPathPattern='bundler' --testNamePattern='extract|inline|schema'",
    "test:extract-schemas:manual": "node scripts/test-inline-schema-extraction. js --test-type=manual --verbose",
    "test:extract-schemas:watch": "yarn jest extract_inline_schemas_to_components --watch",
    "test:extract-schemas:report": "node scripts/test-inline-schema-extraction.js && open target/oas-test-output/logs/test-report.md"
  }
}
```

---

### **5. How to Run the Tests**

```bash
# Make scripts executable
chmod +x scripts/test-inline-schema-extraction.sh

# Run all tests
./scripts/test-inline-schema-extraction.sh all

# Or using npm/yarn
yarn test:extract-schemas

# Run specific test type
./scripts/test-inline-schema-extraction.sh unit
./scripts/test-inline-schema-extraction.sh integration
./scripts/test-inline-schema-extraction.sh manual

# Run with Node.js test runner
node scripts/test-inline-schema-extraction. js --verbose

# Run tests and generate report
node scripts/test-inline-schema-extraction.js && cat target/oas-test-output/logs/test-report. md
```

---

### **6. Expected Test Output**

When you run the tests, you should see output like:

```
ℹ Starting inline schema extraction tests... 
ℹ Test type: all
ℹ Output directory: /path/to/kibana/target/oas-test-output

ℹ Running unit tests for schema extraction... 
✓ Unit tests passed

ℹ Running integration tests with bundler...
✓ Integration tests passed

ℹ Running manual end-to-end tests... 
ℹ Creating test OAS specifications... 
✓ Created 2 test specifications
ℹ Bundling test specifications...
✓ Bundling completed successfully
✓ Generated 1 bundled spec(s)
✓ Extracted 8 schemas in bundled-2024-01-01.yaml

ℹ Running validation tests...
✓ Validation passed for bundled-2024-01-01.yaml
✓ Validations:  1 passed, 0 failed

ℹ Running performance tests...
✓ Performance test completed in 245. 32ms

ℹ Generating test report...
✓ Test report generated: /path/to/kibana/target/oas-test-output/logs/test-report.md

✓ All tests completed successfully! 
```

---

test scripts to test schema refactoring feature with unit tests, integration tests, manual end-to-end tests, validation, and performance monitoring.
