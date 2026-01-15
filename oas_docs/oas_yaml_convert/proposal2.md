I see the system returned a different issue (#245610). Let me fetch the correct issue #244662:Now I have the issue context. Let me explore the existing OAS infrastructure in Kibana to understand the current implementation, particularly in `oas_docs` and the related packages. Now I have a comprehensive understanding of the OAS generation pipeline and the issue. Let me provide a detailed analysis and recommendation for implementing automatic refactoring of request/response bodies to `#/components/schemas`.

## Analysis and Implementation Recommendations

Based on my investigation of issue [#244662](https://github.com/elastic/kibana/issues/244662) and the existing OAS generation infrastructure in Kibana, here's how you could implement automatic refactoring of request/response bodies to `#/components/schemas` within the `oas_docs` domain rather than modifying the generator scripts owned by another team. 

### Current Architecture Overview

The OAS generation pipeline works as follows:

1. **OAS Extraction** (`kbn-router-to-openapispec`): Converts Kibana router definitions to OpenAPI specs
2. **Snapshot Capture** (`capture_oas_snapshot. sh`): Runs Kibana and extracts OAS via `/api/oas` endpoint → outputs to `oas_docs/bundle.json` and `oas_docs/bundle.serverless.json`
3. **Merge & Bundle** (`oas_docs/scripts/merge_*. js`): Merges extracted bundles with hand-written specs using `@kbn/openapi-bundler`
4. **Overlays & Post-processing** (`oas_docs/makefile`): Applies overlays and space-awareness transformations
5. **Final Output**:  `oas_docs/output/kibana. yaml` and `oas_docs/output/kibana.serverless.yaml`

### The Problem

Currently, the `kbn-router-to-openapispec` zod converter ([`lib. ts`](https://github.com/elastic/kibana/tree/main/src/platform/packages/shared/kbn-router-to-openapispec/src/oas_converter/zod/lib.ts#L296-L304)) uses `$refStrategy:  'none'`, which inlines all schemas: 

```typescript
export const convert = (schema: z.ZodTypeAny) => {
  return {
    shared: {},
    schema:  zodToJsonSchema(schema, {
      target: 'openApi3',
      $refStrategy: 'none',  // This causes inlining
    }) as OpenAPIV3.SchemaObject,
  };
};
```

This causes polymorphic bodies (`oneOf`, `anyOf`) to trip up code generators. 

### Recommended Solution:  Post-Processing Script in `oas_docs`

Since you want to keep the implementation in the `oas_docs` domain, I recommend creating a **post-processing script** that runs after the merge step but before overlays. This script would:

1. Parse the merged OAS document
2. Identify inlined request/response body schemas (especially `oneOf`/`anyOf` types)
3. Extract them to `#/components/schemas`
4. Replace inline definitions with `$ref` references
5. Write the refactored document

Here's a proposed implementation:

```javascript name=oas_docs/scripts/refactor_to_component_schemas.js
/*
 * Copyright Elasticsearch B. V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements.  Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1". 
 */

require('@kbn/setup-node-env');
const path = require('node:path');
const fs = require('node:fs');
const yaml = require('js-yaml');
const { run } = require('@kbn/dev-cli-runner');
const { REPO_ROOT } = require('@kbn/repo-info');

/**
 * Generates a unique schema name based on the path and context
 * @param {string} pathName - The API path (e.g., /api/actions/connector)
 * @param {string} method - HTTP method (get, post, etc.)
 * @param {string} context - Context like 'request' or 'response_200'
 * @param {number} [index] - Optional index for oneOf/anyOf items
 */
function generateSchemaName(pathName, method, context, index) {
  // Convert path to PascalCase identifier
  // e.g., /api/actions/connector -> ApiActionsConnector
  const pathPart = pathName
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      // Handle path parameters like {id}
      if (segment.startsWith('{') && segment.endsWith('}')) {
        return segment. slice(1, -1);
      }
      return segment;
    })
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join('');

  const methodPart = method.charAt(0).toUpperCase() + method.slice(1);
  const contextPart = context.charAt(0).toUpperCase() + context.slice(1);

  let name = `${pathPart}${methodPart}${contextPart}`;
  if (typeof index === 'number') {
    name += `${index + 1}`;
  }

  return name;
}

/**
 * Checks if a schema should be extracted (polymorphic types that cause issues)
 */
function shouldExtractSchema(schema) {
  if (! schema || typeof schema !== 'object') return false;
  // Extract oneOf, anyOf, or complex object schemas
  return (
    Array.isArray(schema.oneOf) ||
    Array.isArray(schema.anyOf) ||
    (schema.type === 'object' && schema.properties && Object.keys(schema.properties).length > 3)
  );
}

/**
 * Deep clone an object
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Process the OAS document and refactor inline schemas to component references
 */
function refactorToComponentSchemas(oasDoc) {
  const schemas = oasDoc.components?.schemas || {};
  const extractedSchemas = {};
  let extractionCount = 0;

  // Track existing schema names to avoid collisions
  const existingNames = new Set(Object.keys(schemas));

  /**
   * Get a unique schema name, appending numbers if necessary
   */
  function getUniqueName(baseName) {
    let name = baseName;
    let counter = 1;
    while (existingNames.has(name)) {
      name = `${baseName}${counter}`;
      counter++;
    }
    existingNames.add(name);
    return name;
  }

  /**
   * Extract inline schemas from oneOf/anyOf arrays
   */
  function extractPolymorphicSchemas(schema, pathName, method, context) {
    if (!schema) return schema;

    const polymorphicKey = schema.oneOf ?  'oneOf' : schema.anyOf ? 'anyOf' : null;
    if (! polymorphicKey) return schema;

    const items = schema[polymorphicKey];
    const newItems = items.map((item, index) => {
      // Skip if already a reference
      if (item.$ref) return item;

      // Skip simple types
      if (! item.type && !item.properties && !item.oneOf && !item.anyOf) return item;

      // Extract complex schemas
      const baseName = generateSchemaName(pathName, method, context, index);
      const schemaName = getUniqueName(baseName);
      extractedSchemas[schemaName] = deepClone(item);
      extractionCount++;

      return { $ref: `#/components/schemas/${schemaName}` };
    });

    return {
      ... schema,
      [polymorphicKey]: newItems,
    };
  }

  /**
   * Process request body schema
   */
  function processRequestBody(requestBody, pathName, method) {
    if (!requestBody?. content) return;

    for (const [contentType, content] of Object. entries(requestBody.content)) {
      if (! content. schema) continue;

      if (shouldExtractSchema(content.schema)) {
        if (content.schema.oneOf || content.schema.anyOf) {
          content.schema = extractPolymorphicSchemas(
            content.schema,
            pathName,
            method,
            'Request'
          );
        } else {
          // Extract the entire request body schema
          const baseName = generateSchemaName(pathName, method, 'RequestBody');
          const schemaName = getUniqueName(baseName);
          extractedSchemas[schemaName] = deepClone(content.schema);
          content.schema = { $ref: `#/components/schemas/${schemaName}` };
          extractionCount++;
        }
      }
    }
  }

  /**
   * Process response schemas
   */
  function processResponses(responses, pathName, method) {
    if (!responses) return;

    for (const [statusCode, response] of Object.entries(responses)) {
      if (!response.content) continue;

      for (const [contentType, content] of Object.entries(response. content)) {
        if (!content.schema) continue;

        if (shouldExtractSchema(content. schema)) {
          if (content.schema.oneOf || content. schema.anyOf) {
            content.schema = extractPolymorphicSchemas(
              content. schema,
              pathName,
              method,
              `Response${statusCode}`
            );
          } else {
            // Extract the entire response body schema
            const baseName = generateSchemaName(pathName, method, `Response${statusCode}Body`);
            const schemaName = getUniqueName(baseName);
            extractedSchemas[schemaName] = deepClone(content.schema);
            content.schema = { $ref: `#/components/schemas/${schemaName}` };
            extractionCount++;
          }
        }
      }
    }
  }

  // Process all paths
  for (const [pathName, pathItem] of Object.entries(oasDoc.paths || {})) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete', 'options', 'head']) {
      const operation = pathItem[method];
      if (!operation) continue;

      // Process request body
      if (operation.requestBody) {
        processRequestBody(operation.requestBody, pathName, method);
      }

      // Process responses
      if (operation.responses) {
        processResponses(operation.responses, pathName, method);
      }
    }
  }

  // Merge extracted schemas into components
  oasDoc.components = oasDoc.components || {};
  oasDoc.components.schemas = {
    ...schemas,
    ...extractedSchemas,
  };

  return { document: oasDoc, extractionCount, extractedSchemas };
}

run(
  async ({ log, flagsReader }) => {
    const [relativeFilePath] = flagsReader.getPositionals();
    if (!relativeFilePath) {
      log.error('Please provide a path to the OAS file');
      process.exit(1);
    }

    const absPath = path.resolve(REPO_ROOT, relativeFilePath);
    log.info(`Processing ${absPath}...`);

    const oasDoc = yaml.load(fs.readFileSync(absPath, 'utf8'));

    const { document, extractionCount, extractedSchemas } = refactorToComponentSchemas(oasDoc);

    log.info(`Extracted ${extractionCount} schemas to #/components/schemas`);
    if (flagsReader.boolean('verbose')) {
      log.info('Extracted schemas:', Object.keys(extractedSchemas));
    }

    const outputPath = flagsReader.string('output') || absPath;
    log.info(`Writing refactored document to ${outputPath}...`);
    fs.writeFileSync(outputPath, yaml.dump(document, { noRefs: true, lineWidth: -1 }), 'utf8');
    log.success('Done!');
  },
  {
    description: 'Refactor inline request/response body schemas to #/components/schemas',
    usage: 
      'node scripts/refactor_to_component_schemas.js <path-to-oas-file> [--output <output-path>] [--verbose]',
    flags: {
      string: ['output'],
      boolean: ['verbose'],
      default: {
        verbose: false,
      },
      help: `
        --output    Output file path (defaults to overwriting input file)
        --verbose   Show extracted schema names
      `,
    },
  }
);
```

### Integration with the CI Pipeline

Update the `oas_docs/makefile` to include the new script in the pipeline:

```makefile name=oas_docs/makefile (additions)
.PHONY: api-docs
api-docs:  ## Generate Serverless and ESS Kibana OpenAPI bundles
	$(MAKE) merge-api-docs
	$(MAKE) refactor-component-schemas  # NEW STEP
	$(MAKE) api-docs-overlay
	$(MAKE) space-aware-api-docs

.PHONY: refactor-component-schemas
refactor-component-schemas: ## Refactor inline schemas to #/components/schemas
	@node scripts/refactor_to_component_schemas.js oas_docs/output/kibana.yaml
	@node scripts/refactor_to_component_schemas.js oas_docs/output/kibana.serverless.yaml
```

### Alternative: Using OpenAPI Overlays

If you prefer a more declarative approach, you could use the existing overlay mechanism.  However, overlays are better suited for static modifications rather than dynamic schema extraction.  The script approach is more appropriate for this use case.

### Considerations

1. **Schema Naming**: The proposed naming convention (`{PathPascalCase}{Method}{Context}{Index}`) ensures unique, descriptive names.  You may want to refine this based on your preferences.

2. **Deduplication**: For a more advanced implementation, you could add schema content hashing to detect and reuse identical schemas across different paths.

3. **Selective Extraction**: The `shouldExtractSchema` function currently targets `oneOf`/`anyOf` and complex objects. You can adjust the criteria based on which patterns cause issues with your code generators.

4. **Testing**: Test with `https://editor.swagger.io/` or your target code generator to verify the refactored schemas work correctly.

5. **Related Issue**: This approach complements [#245610](https://github.com/elastic/kibana/issues/245610) which proposes enhancing the zod converter with `definitions` support upstream.  Your post-processing script provides a solution that works now without modifying the generator package.

### Summary

| Approach | Location | Pros | Cons |
|----------|----------|------|------|
| **Post-processing script** (recommended) | `oas_docs/scripts/` | Works now, no dependencies on other teams, handles all schema types | Runs after generation, slight overhead |
| **Upstream zod converter change** (#245610) | `kbn-router-to-openapispec` | Fixes at source, optimal output | Requires coordination with owning team |
| **OpenAPI Overlays** | `oas_docs/overlays/` | Declarative | Not suitable for dynamic transformations |
