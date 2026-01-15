I'll create a comprehensive set of utilities for the post-processing schema extraction approach:

## Complete Utilities for Inline Schema Extraction

### **1. Core Utility Module**

```typescript name=schema-extractor.ts url=https://github.com/elastic/kibana/tree/main/oas_docs/scripts/lib/schema-extractor.ts
/*
 * Copyright Elasticsearch B. V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { OpenAPIV3 } from 'openapi-types';

/**
 * Options for schema extraction
 */
export interface SchemaExtractionOptions {
  minComplexity?: number;
  maxDepth?: number;
  namingPrefix?: string;
  extractSingleItems?: boolean;
  verbose?: boolean;
  skipPaths?: string[];
  preserveOriginalNames?: boolean;
}

/**
 * Extraction statistics
 */
export interface ExtractionStats {
  schemasExtracted: number;
  compositionsFound: number;
  oneOfCount: number;
  anyOfCount: number;
  allOfCount: number;
  discriminatorsPreserved: number;
  maxDepthReached: number;
}

/**
 * Tracks extracted schemas and their locations
 */
interface ExtractionTracker {
  schemas: Map<string, OpenAPIV3.SchemaObject>;
  replacements: Map<string, string>;
  nameCounters: Map<string, number>;
  discriminators: Map<string, OpenAPIV3.DiscriminatorObject>;
  stats: ExtractionStats;
}

/**
 * Tracks the path through the schema tree
 */
interface SchemaPath {
  parts: (string | number)[];
  toString(): string;
}

/**
 * Post-processing schema extractor for OpenAPI documents
 *
 * Traverses an OpenAPI document and extracts inline schemas from
 * oneOf/anyOf/allOf compositions, moving them to components/schemas
 * and replacing with $ref pointers. 
 *
 * This runs AFTER bundling as a standalone post-processing step.
 */
export class SchemaExtractor {
  private tracker: ExtractionTracker;
  private options: Required<SchemaExtractionOptions>;
  private logger: Logger;

  constructor(options: SchemaExtractionOptions = {}, logger?:  Logger) {
    this.options = {
      minComplexity: options.minComplexity ??  2,
      maxDepth: options.maxDepth ?? 10,
      namingPrefix: options.namingPrefix ?? 'Generated',
      extractSingleItems:  options.extractSingleItems ?? false,
      verbose: options.verbose ?? false,
      skipPaths: options.skipPaths ?? [],
      preserveOriginalNames:  options.preserveOriginalNames ??  false,
    };

    this.logger = logger || new ConsoleLogger(this.options.verbose);

    this.tracker = {
      schemas: new Map(),
      replacements: new Map(),
      nameCounters: new Map(),
      discriminators: new Map(),
      stats: {
        schemasExtracted: 0,
        compositionsFound: 0,
        oneOfCount: 0,
        anyOfCount: 0,
        allOfCount: 0,
        discriminatorsPreserved: 0,
        maxDepthReached: 0,
      },
    };
  }

  /**
   * Process an OpenAPI document and extract inline schemas
   */
  process(document: OpenAPIV3.Document): OpenAPIV3.Document {
    this.logger.info('Starting schema extraction...');

    if (!document. paths) {
      this.logger. info('No paths found in document');
      return document;
    }

    // First pass: identify schemas to extract
    this.identifySchemasToExtract(document);

    // Second pass: apply extractions
    this.applyExtractions(document);

    // Third pass: add extracted schemas to components
    this.addExtractedSchemasToComponents(document);

    this.logStats();

    return document;
  }

  /**
   * First pass: identify and extract inline schemas from compositions
   */
  private identifySchemasToExtract(document: OpenAPIV3.Document): void {
    const paths = document.paths || {};

    for (const [pathName, pathItem] of Object. entries(paths)) {
      if (! pathItem) continue;

      // Check if path should be skipped
      if (this.shouldSkipPath(pathName)) {
        this.logger.debug(`Skipping path: ${pathName}`);
        continue;
      }

      for (const [method, operation] of Object.entries(pathItem)) {
        // Skip non-operation keys
        if (method === 'parameters' || method === 'servers' || ! operation) continue;

        const op = operation as OpenAPIV3.OperationObject;

        // Check request body
        if (op.requestBody && typeof op.requestBody === 'object' && 'content' in op. requestBody) {
          this.analyzeRequestBody(
            op.requestBody as OpenAPIV3.RequestBodyObject,
            pathName,
            method,
            op.operationId
          );
        }

        // Check responses
        if (op.responses) {
          this.analyzeResponses(op. responses, pathName, method, op.operationId);
        }
      }
    }
  }

  /**
   * Analyze request body for extractable schemas
   */
  private analyzeRequestBody(
    requestBody: OpenAPIV3.RequestBodyObject,
    path: string,
    method: string,
    operationId?:  string
  ): void {
    if (! requestBody. content) return;

    for (const [contentType, mediaType] of Object.entries(requestBody.content)) {
      if (! mediaType. schema) continue;

      const schema = mediaType.schema as OpenAPIV3.SchemaObject;
      const schemaPath = new SchemePath([
        'paths',
        path,
        method,
        'requestBody',
        'content',
        contentType,
        'schema',
      ]);

      this.analyzeSchema(schema, schemaPath, {
        operationId,
        method,
        isRequest: true,
        description: requestBody.description,
      });
    }
  }

  /**
   * Analyze responses for extractable schemas
   */
  private analyzeResponses(
    responses: OpenAPIV3.ResponsesObject,
    path: string,
    method: string,
    operationId?: string
  ): void {
    for (const [statusCode, response] of Object.entries(responses)) {
      if (typeof response !== 'object' || ! response) continue;

      const responseObj = response as OpenAPIV3.ResponseObject;
      if (!responseObj.content) continue;

      for (const [contentType, mediaType] of Object.entries(responseObj.content)) {
        if (!mediaType.schema) continue;

        const schema = mediaType.schema as OpenAPIV3.SchemaObject;
        const schemaPath = new SchemePath([
          'paths',
          path,
          method,
          'responses',
          statusCode,
          'content',
          contentType,
          'schema',
        ]);

        this.analyzeSchema(schema, schemaPath, {
          operationId,
          method,
          statusCode,
          isRequest: false,
          description: responseObj.description,
        });
      }
    }
  }

  /**
   * Recursively analyze a schema for extraction opportunities
   */
  private analyzeSchema(
    schema: OpenAPIV3.SchemaObject,
    schemaPath: SchemePath,
    metadata:  {
      operationId?:  string;
      method?: string;
      statusCode?: string;
      isRequest?: boolean;
      description?: string;
    },
    depth: number = 0
  ): void {
    if (! schema || typeof schema !== 'object') return;

    // Skip references - they're already refactored
    if ('$ref' in schema) return;

    // Track max depth reached
    if (depth > this. tracker.stats.maxDepthReached) {
      this.tracker.stats.maxDepthReached = depth;
    }

    // Check for composition operators
    const compositionType = this.getCompositionType(schema);

    if (compositionType) {
      this.tracker.stats.compositionsFound++;

      // Track composition type counts
      switch (compositionType) {
        case 'oneOf':
          this.tracker.stats.oneOfCount++;
          break;
        case 'anyOf':
          this.tracker.stats.anyOfCount++;
          break;
        case 'allOf':
          this.tracker.stats.allOfCount++;
          break;
      }

      const items = schema[compositionType] as OpenAPIV3.SchemaObject[];

      // Skip if all items are already references
      if (items.every((item) => '$ref' in item)) {
        this.logger.debug(`Skipping composition at ${schemaPath. toString()} (all items are refs)`);
        return;
      }

      // Skip single-item compositions unless configured
      if (items.length === 1 && ! this.options.extractSingleItems) {
        return;
      }

      // Calculate complexity
      const complexity = this.calculateComplexity(schema, compositionType);

      if (complexity >= this.options.minComplexity && depth < this.options.maxDepth) {
        // Mark for extraction
        const schemaName = this.generateSchemaName(metadata, schemaPath, compositionType);
        const schemaCopy = JSON.parse(JSON.stringify(schema));

        // Preserve discriminator if present
        if (schema.discriminator) {
          this.tracker.discriminators.set(schemaName, schema.discriminator);
          this.tracker.stats.discriminatorsPreserved++;
        }

        this.tracker.replacements.set(schemaPath. toString(), schemaName);
        this.tracker.schemas.set(schemaName, schemaCopy);
        this.tracker.stats.schemasExtracted++;

        this. logger.debug(
          `Marked for extraction: ${schemaName} (complexity: ${complexity}) at ${schemaPath.toString()}`
        );

        // Also extract individual items if they're complex enough
        items.forEach((item, index) => {
          if ('$ref' in item || ! this.isComplexSchema(item)) return;

          const itemName = `${schemaName}${String. fromCharCode(65 + index)}`;
          const itemPath = schemaPath.append(`${compositionType}`, index);

          this.tracker.replacements.set(itemPath.toString(), itemName);
          this.tracker.schemas.set(itemName, JSON.parse(JSON.stringify(item)));
          this.tracker.stats.schemasExtracted++;
        });
      }
    }

    // Recursively analyze nested structures
    if (depth < this.options.maxDepth) {
      if (schema.properties) {
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
          if (typeof propSchema === 'object' && propSchema !== null) {
            this.analyzeSchema(
              propSchema as OpenAPIV3.SchemaObject,
              schemaPath.append('properties', propName),
              metadata,
              depth + 1
            );
          }
        }
      }

      if (schema.items && typeof schema.items === 'object') {
        this.analyzeSchema(
          schema.items as OpenAPIV3.SchemaObject,
          schemaPath.append('items'),
          metadata,
          depth + 1
        );
      }

      if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        this.analyzeSchema(
          schema. additionalProperties as OpenAPIV3.SchemaObject,
          schemaPath.append('additionalProperties'),
          metadata,
          depth + 1
        );
      }
    }
  }

  /**
   * Second pass: apply replacements to document
   */
  private applyExtractions(document: OpenAPIV3.Document): void {
    this.logger.info('Applying extractions to document...');

    const paths = document.paths || {};

    for (const [pathName, pathItem] of Object.entries(paths)) {
      if (!pathItem) continue;

      for (const [method, operation] of Object.entries(pathItem)) {
        if (method === 'parameters' || method === 'servers' || !operation) continue;

        const op = operation as OpenAPIV3.OperationObject;

        // Apply to request body
        if (op.requestBody && typeof op.requestBody === 'object' && 'content' in op.requestBody) {
          const requestBody = op.requestBody as OpenAPIV3.RequestBodyObject;
          for (const [contentType, mediaType] of Object.entries(requestBody.content || {})) {
            const contextPath = new SchemePath([
              'paths',
              pathName,
              method,
              'requestBody',
              'content',
              contentType,
              'schema',
            ]).toString();

            if (this.tracker.replacements. has(contextPath)) {
              const schemaName = this.tracker.replacements.get(contextPath)!;
              mediaType.schema = { $ref: `#/components/schemas/${schemaName}` };
            }
          }
        }

        // Apply to responses
        if (op.responses) {
          for (const [statusCode, response] of Object.entries(op.responses)) {
            if (typeof response !== 'object' || !response) continue;

            const responseObj = response as OpenAPIV3.ResponseObject;
            for (const [contentType, mediaType] of Object.entries(responseObj.content || {})) {
              const contextPath = new SchemePath([
                'paths',
                pathName,
                method,
                'responses',
                statusCode,
                'content',
                contentType,
                'schema',
              ]).toString();

              if (this.tracker.replacements.has(contextPath)) {
                const schemaName = this. tracker.replacements.get(contextPath)!;
                mediaType.schema = { $ref: `#/components/schemas/${schemaName}` };
              }
            }
          }
        }
      }
    }
  }

  /**
   * Third pass: add extracted schemas to components
   */
  private addExtractedSchemasToComponents(document: OpenAPIV3.Document): void {
    if (this.tracker.schemas.size === 0) {
      this.logger.info('No schemas to add to components');
      return;
    }

    this.logger.info(`Adding ${this.tracker.schemas. size} schemas to components... `);

    if (! document.components) {
      document.components = {};
    }

    if (! document.components. schemas) {
      document.components.schemas = {};
    }

    for (const [name, schema] of this.tracker. schemas) {
      if (!document.components.schemas[name]) {
        // Add discriminator back if it exists
        if (this.tracker.discriminators.has(name)) {
          schema.discriminator = this.tracker. discriminators.get(name);
        }

        document.components.schemas[name] = schema;
        this.logger.debug(`Added schema:  ${name}`);
      } else {
        this.logger.debug(`Schema ${name} already exists, skipping`);
      }
    }
  }

  /**
   * Get composition type if schema has oneOf/anyOf/allOf
   */
  private getCompositionType(
    schema: OpenAPIV3.SchemaObject
  ): 'oneOf' | 'anyOf' | 'allOf' | null {
    if ('oneOf' in schema && Array.isArray(schema.oneOf) && schema.oneOf.length > 0)
      return 'oneOf';
    if ('anyOf' in schema && Array.isArray(schema.anyOf) && schema.anyOf.length > 0) return 'anyOf';
    if ('allOf' in schema && Array.isArray(schema.allOf) && schema.allOf.length > 0) return 'allOf';
    return null;
  }

  /**
   * Check if schema is complex enough to extract
   */
  private isComplexSchema(schema: OpenAPIV3.SchemaObject): boolean {
    if (! schema || typeof schema !== 'object') return false;

    return (
      Boolean(schema.properties && Object.keys(schema.properties).length > 0) ||
      Boolean(schema.oneOf || schema.anyOf || schema.allOf) ||
      Boolean(schema.items)
    );
  }

  /**
   * Calculate complexity score
   */
  private calculateComplexity(schema: OpenAPIV3.SchemaObject, compositionType: string): number {
    let score = 1;

    // Add for composition items
    const items = schema[compositionType as keyof typeof schema] as
      | OpenAPIV3.SchemaObject[]
      | undefined;
    if (items) {
      score += items.length * 2;

      // Extra for nested compositions
      items.forEach((item) => {
        if (this.getCompositionType(item)) {
          score += 2;
        }
      });
    }

    // Add for properties
    if (schema.properties) {
      score += Object.keys(schema.properties).length;
    }

    // Add for discriminator
    if ('discriminator' in schema && schema.discriminator) {
      score += 2;
    }

    return score;
  }

  /**
   * Generate unique schema name
   */
  private generateSchemaName(
    metadata: {
      operationId?: string;
      method?:  string;
      statusCode?: string;
      isRequest?: boolean;
    },
    schemaPath: SchemePath,
    compositionType: string
  ): string {
    let baseName = this.options.namingPrefix;

    // Prefer operationId
    if (metadata.operationId) {
      baseName = metadata.operationId;
      if (metadata.isRequest) {
        baseName += 'Request';
      } else if (metadata.statusCode) {
        baseName += `Response${metadata.statusCode}`;
      } else {
        baseName += 'Response';
      }
    } else {
      // Fallback:  derive from path
      baseName += metadata.method ?  metadata.method.toUpperCase() : 'Request';
      if (metadata.statusCode) {
        baseName += metadata.statusCode;
      }
    }

    // Ensure uniqueness
    return this.ensureUniqueName(baseName);
  }

  /**
   * Ensure schema name is unique
   */
  private ensureUniqueName(baseName: string): string {
    if (! this.tracker.schemas.has(baseName)) {
      return baseName;
    }

    let counter = this.tracker.nameCounters.get(baseName) || 1;
    let uniqueName = `${baseName}${counter}`;

    while (this.tracker.schemas.has(uniqueName)) {
      counter++;
      uniqueName = `${baseName}${counter}`;
    }

    this.tracker.nameCounters.set(baseName, counter + 1);
    return uniqueName;
  }

  /**
   * Check if path should be skipped
   */
  private shouldSkipPath(pathName: string): boolean {
    return this.options.skipPaths. some(
      (pattern) => pathName === pattern || new RegExp(pattern).test(pathName)
    );
  }

  /**
   * Get extraction statistics
   */
  getStats(): ExtractionStats {
    return { ... this.tracker.stats };
  }

  /**
   * Log statistics
   */
  private logStats(): void {
    const stats = this.tracker.stats;
    this.logger.info(`Schema extraction complete:`);
    this.logger.info(
      `  • Schemas extracted: ${stats.schemasExtracted} from ${stats.compositionsFound} compositions`
    );
    this.logger.info(`  • oneOf:  ${stats.oneOfCount}, anyOf: ${stats.anyOfCount}, allOf: ${stats. allOfCount}`);
    this.logger.info(`  • Discriminators preserved: ${stats.discriminatorsPreserved}`);
    this.logger.info(`  • Max depth reached: ${stats.maxDepthReached}`);
  }
}

/**
 * Schema path utility
 */
class SchemePath implements SchemaPath {
  parts: (string | number)[];

  constructor(parts: (string | number)[] = []) {
    this.parts = parts;
  }

  append(... newParts: (string | number)[]): SchemePath {
    return new SchemePath([...this.parts, ...newParts]);
  }

  toString(): string {
    return this. parts.join('.');
  }
}

/**
 * Logger interface
 */
export interface Logger {
  info(message: string): void;
  debug(message: string): void;
  warn(message: string): void;
  error(message:  string): void;
}

/**
 * Console-based logger
 */
class ConsoleLogger implements Logger {
  constructor(private verbose: boolean = false) {}

  info(message: string): void {
    console.log(message);
  }

  debug(message: string): void {
    if (this.verbose) {
      console.log(`  ${message}`);
    }
  }

  warn(message:  string): void {
    console. warn(`⚠ ${message}`);
  }

  error(message: string): void {
    console.error(`✗ ${message}`);
  }
}

export { ConsoleLogger };
```

---

### **2. File I/O Utilities**

```typescript name=file-handler. ts url=https://github.com/elastic/kibana/tree/main/oas_docs/scripts/lib/file-handler.ts
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
import yaml from 'js-yaml';
import type { OpenAPIV3 } from 'openapi-types';
import type { Logger } from './schema-extractor';

/**
 * File handler for reading and writing OpenAPI documents
 */
export class FileHandler {
  constructor(private logger: Logger) {}

  /**
   * Read an OpenAPI document from file
   */
  readOasDocument(filePath: string): OpenAPIV3.Document {
    this.logger.info(`Reading OpenAPI document from ${filePath}...`);

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const doc = yaml.load(content);

      if (!doc || typeof doc !== 'object') {
        throw new Error('Invalid YAML document');
      }

      this.logger.debug(`Successfully read OpenAPI document`);
      return doc as OpenAPIV3.Document;
    } catch (error) {
      if (error instanceof yaml.YAMLException) {
        throw new Error(`YAML parse error in ${filePath}: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Write an OpenAPI document to file
   */
  writeOasDocument(document: OpenAPIV3.Document, filePath: string): void {
    this.logger.info(`Writing OpenAPI document to ${filePath}...`);

    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Convert to YAML with pretty formatting
      const yaml_content = yaml.dump(document, {
        skipInvalid: true,
        lineWidth: -1, // Prevent line wrapping
        sortKeys: true, // Keep keys sorted for consistent output
        noRefs: true, // Don't use YAML references
      });

      fs.writeFileSync(filePath, yaml_content, 'utf8');
      this.logger.debug(`Successfully wrote OpenAPI document`);
    } catch (error) {
      throw new Error(`Failed to write file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create a backup of the original file
   */
  createBackup(filePath: string): string {
    const backupPath = `${filePath}.backup`;

    if (fs.existsSync(filePath)) {
      fs.copyFileSync(filePath, backupPath);
      this.logger.debug(`Created backup at ${backupPath}`);
    }

    return backupPath;
  }

  /**
   * Get file statistics
   */
  getFileStats(filePath: string): { size: string; lines: number } {
    if (!fs.existsSync(filePath)) {
      return { size: '0B', lines: 0 };
    }

    const sizeInBytes = fs.statSync(filePath).size;
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').length;

    return {
      size: this.formatBytes(sizeInBytes),
      lines,
    };
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + sizes[i];
  }

  /**
   * List YAML files in a directory
   */
  listYamlFiles(dirPath: string): string[] {
    if (!fs.existsSync(dirPath)) {
      return [];
    }

    return fs
      .readdirSync(dirPath)
      .filter((file) => file.endsWith('.yaml') || file.endsWith('.yml'))
      .map((file) => path.join(dirPath, file));
  }

  /**
   * Clean up backup files
   */
  cleanupBackups(filePath: string): void {
    const backupPath = `${filePath}.backup`;

    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
      this.logger.debug(`Removed backup at ${backupPath}`);
    }
  }
}
```

---

### **3. Report Generator**

```typescript name=report-generator.ts url=https://github.com/elastic/kibana/tree/main/oas_docs/scripts/lib/report-generator.ts
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
import type { ExtractionStats } from './schema-extractor';
import type { Logger } from './schema-extractor';

/**
 * Report metadata
 */
export interface ReportMetadata {
  timestamp: Date;
  inputFile: string;
  outputFile: string;
  duration: number;
  success: boolean;
  error?:  string;
}

/**
 * Generates reports for schema extraction operations
 */
export class ReportGenerator {
  constructor(private logger: Logger) {}

  /**
   * Generate a markdown report
   */
  generateMarkdownReport(
    metadata: ReportMetadata,
    stats:  ExtractionStats,
    fileStats: { inputSize: string; outputSize: string; inputLines: number; outputLines: number }
  ): string {
    const timestamp = metadata.timestamp.toISOString();
    const duration = (metadata.duration / 1000).toFixed(2);

    const report = `# Schema Extraction Report

**Generated:** ${timestamp}  
**Status:** ${metadata.success ? '✓ SUCCESS' : '✗ FAILED'}

## Extraction Summary

| Metric | Value |
|--------|-------|
| Input File | \`${path.basename(metadata.inputFile)}\` |
| Output File | \`${path.basename(metadata.outputFile)}\` |
| Duration | ${duration}s |
| Schemas Extracted | ${stats.schemasExtracted} |
| Compositions Found | ${stats.compositionsFound} |
| oneOf | ${stats.oneOfCount} |
| anyOf | ${stats. anyOfCount} |
| allOf | ${stats.allOfCount} |
| Discriminators Preserved | ${stats.discriminatorsPreserved} |
| Max Depth Reached | ${stats.maxDepthReached} |

## File Statistics

| Metric | Input | Output | Change |
|--------|-------|--------|--------|
| File Size | ${fileStats.inputSize} | ${fileStats.outputSize} | ${this.calculateChange(fileStats.inputSize, fileStats.outputSize)} |
| Lines | ${fileStats.inputLines} | ${fileStats.outputLines} | ${this.calculateLineChange(fileStats.inputLines, fileStats.outputLines)} |

## Schema Extraction Details

### Composition Types

- **oneOf**: Used to define schemas where exactly one must be valid
  - Count: ${stats.oneOfCount}
  - Best for: Discriminated unions

- **anyOf**: Used to define schemas where one or more can be valid  
  - Count: ${stats. anyOfCount}
  - Best for: Multiple valid schemas

- **allOf**: Used to define schemas where all must be valid
  - Count: ${stats. allOfCount}
  - Best for: Schema composition/inheritance

### Preservation

- **Discriminators**: ${stats.discriminatorsPreserved} discriminator(s) were preserved
  - These help client generators select the correct schema variant

## Performance

- Extraction completed in **${duration}s**
- Average complexity per schema: ${(stats.compositionsFound / stats.schemasExtracted).toFixed(2)}

## Next Steps

1. Review the extracted schemas in \`#/components/schemas\`
2. Validate with OpenAPI linter:  \`npx @redocly/cli lint\`
3. Test with client code generators
4. Commit the refactored specification

---

Generated by Schema Extraction Utility
`;

    return report;
  }

  /**
   * Save report to file
   */
  saveReport(report: string, outputPath: string): void {
    const dir = path.dirname(outputPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, report, 'utf8');
    this.logger.info(`Report saved to ${outputPath}`);
  }

  /**
   * Generate JSON report for programmatic use
   */
  generateJsonReport(
    metadata: ReportMetadata,
    stats: ExtractionStats,
    fileStats: { inputSize: string; outputSize: string; inputLines: number; outputLines: number }
  ): Record<string, unknown> {
    return {
      metadata:  {
        timestamp: metadata.timestamp.toISOString(),
        inputFile: metadata.inputFile,
        outputFile: metadata.outputFile,
        duration: metadata. duration,
        success: metadata. success,
        error: metadata.error,
      },
      statistics: stats,
      files: {
        input: {
          size: fileStats.inputSize,
          lines: fileStats. inputLines,
        },
        output: {
          size: fileStats.outputSize,
          lines: fileStats.outputLines,
        },
      },
    };
  }

  /**
   * Print summary to console
   */
  printSummary(metadata: ReportMetadata, stats: ExtractionStats): void {
    const duration = (metadata.duration / 1000).toFixed(2);

    this.logger.info('');
    this.logger.info('═══════════════════════════════════════════════════════════');
    this.logger.info('  SCHEMA EXTRACTION SUMMARY');
    this.logger.info('═══════════════════════════════════════════════════════════');
    this.logger.info('');
    this.logger.info(`  Status:               ${metadata.success ? '✓ SUCCESS' : '✗ FAILED'}`);
    this.logger.info(`  Duration:            ${duration}s`);
    this.logger.info(`  Schemas Extracted:   ${stats.schemasExtracted}`);
    this.logger.info(`  Compositions Found:  ${stats.compositionsFound}`);
    this.logger.info(`    • oneOf:            ${stats.oneOfCount}`);
    this.logger.info(`    • anyOf:           ${stats.anyOfCount}`);
    this.logger.info(`    • allOf:           ${stats.allOfCount}`);
    this.logger.info(`  Discriminators:       ${stats.discriminatorsPreserved}`);
    this.logger.info(`  Max Depth:           ${stats.maxDepthReached}`);
    this.logger.info('');
    this.logger.info('═══════════════════════════════════════════════════════════');
    this.logger.info('');
  }

  /**
   * Calculate file size change
   */
  private calculateChange(input: string, output: string): string {
    // Simple string comparison - in production, parse actual sizes
    return '~0%';
  }

  /**
   * Calculate line count change
   */
  private calculateLineChange(inputLines: number, outputLines: number): string {
    if (inputLines === 0) return 'N/A';
    const change = ((outputLines - inputLines) / inputLines * 100).toFixed(1);
    const sign = outputLines >= inputLines ? '+' : '';
    return `${sign}${change}%`;
  }
}
```

---

### **4.  Validation Utilities**

```typescript name=validator.ts url=https://github.com/elastic/kibana/tree/main/oas_docs/scripts/lib/validator.ts
/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { OpenAPIV3 } from 'openapi-types';
import type { Logger } from './schema-extractor';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  type: string;
  message: string;
  location?: string;
  severity:  'critical' | 'error';
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  type: string;
  message: string;
  location?: string;
}

/**
 * Validates OpenAPI documents after schema extraction
 */
export class Validator {
  constructor(private logger: Logger) {}

  /**
   * Validate a document after extraction
   */
  validate(document: OpenAPIV3.Document): ValidationResult {
    this.logger.info('Validating extracted document...');

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check basic structure
    if (!document. openapi) {
      errors.push({
        type: 'missing_openapi_version',
        message: 'Missing openapi version field',
        severity: 'critical',
      });
    }

    if (!document.info) {
      errors.push({
        type: 'missing_info',
        message: 'Missing info object',
        severity: 'critical',
      });
    }

    // Validate components/schemas
    if (document.components?. schemas) {
      this.validateSchemas(document, errors, warnings);
    }

    // Validate references
    if (document.paths) {
      this.validateReferences(document, errors, warnings);
    }

    // Validate discriminators
    if (document.components?.schemas) {
      this.validateDiscriminators(document, errors, warnings);
    }

    const valid = errors.length === 0 && errors.every((e) => e.severity !== 'critical');

    this.logger.debug(`Validation complete:  ${errors.length} errors, ${warnings. length} warnings`);

    return { valid, errors, warnings };
  }

  /**
   * Validate schemas structure
   */
  private validateSchemas(
    document: OpenAPIV3.Document,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const schemas = document.components?.schemas || {};

    for (const [name, schema] of Object.entries(schemas)) {
      if (!schema || typeof schema !== 'object') {
        errors.push({
          type: 'invalid_schema',
          message: `Schema "${name}" is not an object`,
          location: `components.schemas.${name}`,
          severity: 'error',
        });
        continue;
      }

      // Check for empty schemas
      if (Object.keys(schema).length === 0) {
        warnings.push({
          type: 'empty_schema',
          message: `Schema "${name}" is empty`,
          location: `components.schemas.${name}`,
        });
      }

      // Validate $ref in schema
      if ('$ref' in schema && Object.keys(schema).length > 1) {
        warnings.push({
          type: 'schema_with_ref_and_siblings',
          message: `Schema "${name}" contains $ref with sibling properties`,
          location: `components.schemas.${name}`,
        });
      }
    }
  }

  /**
   * Validate all references are resolvable
   */
  private validateReferences(
    document:  OpenAPIV3.Document,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const schemas = document.components?.schemas || {};
    const visited = new Set<string>();

    const walkSchema = (
      schema: OpenAPIV3.SchemaObject,
      path: string = ''
    ): void => {
      if (! schema || typeof schema !== 'object' || visited.has(JSON.stringify(schema))) {
        return;
      }

      visited.add(JSON.stringify(schema));

      if ('$ref' in schema) {
        const refPath = schema.$ref.replace('#/components/schemas/', '');

        if (! schemas[refPath]) {
          errors.push({
            type: 'broken_reference',
            message: `Reference to undefined schema:  ${schema.$ref}`,
            location: path,
            severity: 'critical',
          });
        }
      }

      // Walk compositions
      if (schema.oneOf) {
        schema.oneOf.forEach((item, idx) => walkSchema(item as OpenAPIV3.SchemaObject, `${path}.oneOf[${idx}]`));
      }
      if (schema.anyOf) {
        schema.anyOf. forEach((item, idx) => walkSchema(item as OpenAPIV3.SchemaObject, `${path}.anyOf[${idx}]`));
      }
      if (schema.allOf) {
        schema.allOf.forEach((item, idx) => walkSchema(item as OpenAPIV3.SchemaObject, `${path}.allOf[${idx}]`));
      }

      // Walk properties
      if (schema.properties) {
        for (const [key, prop] of Object.entries(schema. properties)) {
          walkSchema(prop as OpenAPIV3.SchemaObject, `${path}.properties.${key}`);
        }
      }

      // Walk items
      if (schema.items) {
        walkSchema(schema.items as OpenAPIV3.SchemaObject, `${path}.items`);
      }

      if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        walkSchema(schema.additionalProperties as OpenAPIV3.SchemaObject, `${path}.additionalProperties`);
      }
    };

    // Validate paths
    const paths = document.paths || {};
    for (const [pathName, pathItem] of Object.entries(paths)) {
      for (const [method, operation] of Object.entries(pathItem || {})) {
        if (method === 'parameters' || method === 'servers') continue;

        const op = operation as OpenAPIV3.OperationObject;

        // Check request body
        if (op.requestBody) {
          const rb = op.requestBody as OpenAPIV3.RequestBodyObject;
          for (const [contentType, media] of Object.entries(rb. content || {})) {
            if (media.schema) {
              walkSchema(
                media.schema as OpenAPIV3.SchemaObject,
                `paths.${pathName}.${method}. requestBody.content.${contentType}. schema`
              );
            }
          }
        }

        // Check responses
        if (op.responses) {
          for (const [statusCode, response] of Object.entries(op.responses)) {
            const resp = response as OpenAPIV3.ResponseObject;
            for (const [contentType, media] of Object.entries(resp.content || {})) {
              if (media.schema) {
                walkSchema(
                  media.schema as OpenAPIV3.SchemaObject,
                  `paths.${pathName}.${method}.responses.${statusCode}.content.${contentType}.schema`
                );
              }
            }
          }
        }
      }
    }
  }

  /**
   * Validate discriminator mappings
   */
  private validateDiscriminators(
    document:  OpenAPIV3.Document,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const schemas = document.components?.schemas || {};

    for (const [name, schema] of Object.entries(schemas)) {
      if (!schema || typeof schema !== 'object' || !('discriminator' in schema)) {
        continue;
      }

      const discriminator = schema.discriminator as OpenAPIV3.DiscriminatorObject;

      // Check if discriminator has mapping
      if (!discriminator.mapping) {
        warnings.push({
          type: 'missing_discriminator_mapping',
          message: `Schema "${name}" has discriminator without mapping`,
          location: `components.schemas.${name}. discriminator`,
        });
        continue;
      }

      // Validate mapping references
      for (const [key, ref] of Object.entries(discriminator.mapping)) {
        const refName = ref.replace('#/components/schemas/', '');

        if (!schemas[refName]) {
          errors.push({
            type: 'invalid_discriminator_mapping',
            message: `Discriminator mapping references undefined schema: ${ref}`,
            location: `components.schemas.${name}.discriminator.mapping.${key}`,
            severity: 'error',
          });
        }
      }
    }
  }

  /**
   * Print validation results
   */
  printResults(result: ValidationResult): void {
    if (result.valid) {
      this.logger.info('✓ Validation passed');
    } else {
      this.logger.error(`✗ Validation failed with ${result.errors.length} error(s)`);
    }

    if (result.errors.length > 0) {
      this.logger.error('Errors:');
      result.errors.forEach((err) => {
        this.logger.error(`  • [${err.type}] ${err.message}${err.location ?  ` at ${err.location}` : ''}`);
      });
    }

    if (result.warnings. length > 0) {
      this.logger.warn('Warnings:');
      result.warnings. forEach((warn) => {
        this.logger.warn(
          `  • [${warn.type}] ${warn.message}${warn.location ? ` at ${warn.location}` : ''}`
        );
      });
    }
  }
}
```

---

### **5. CLI Handler**

```typescript name=cli-handler.ts url=https://github.com/elastic/kibana/tree/main/oas_docs/scripts/lib/cli-handler.ts
/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

/**
 * CLI argument parser
 */
export interface CliArgs {
  inputFile: string;
  outputFile?:  string;
  verbose:  boolean;
  minComplexity: number;
  maxDepth: number;
  backup: boolean;
  skipPaths: string[];
  reportFile?: string;
  validate: boolean;
  help: boolean;
}

/**
 * Parses CLI arguments
 */
export class CliHandler {
  /**
   * Parse command line arguments
   */
  static parseArgs(argv: string[]): CliArgs {
    const args:  CliArgs = {
      inputFile: '',
      outputFile: undefined,
      verbose: false,
      minComplexity: 2,
      maxDepth: 10,
      backup: true,
      skipPaths: [],
      reportFile: undefined,
      validate: true,
      help: false,
    };

    for (let i = 0; i < argv.length; i++) {
      const arg = argv[i];

      if (arg === '-h' || arg === '--help') {
        args.help = true;
      } else if (arg === '-v' || arg === '--verbose') {
        args.verbose = true;
      } else if (arg === '--no-backup') {
        args.backup = false;
      } else if (arg === '--no-validate') {
        args.validate = false;
      } else if (arg. startsWith('--min-complexity=')) {
        args.minComplexity = parseInt(arg.split('=')[1]);
      } else if (arg. startsWith('--max-depth=')) {
        args.maxDepth = parseInt(arg.split('=')[1]);
      } else if (arg.startsWith('--skip-paths=')) {
        args.skipPaths = arg. split('=')[1].split(',');
      } else if (arg. startsWith('--report=')) {
        args.reportFile = arg.split('=')[1];
      } else if (! arg.startsWith('-')) {
        if (! args.inputFile) {
          args.inputFile = arg;
        } else if (! args.outputFile) {
          args.outputFile = arg;
        }
      }
    }

    return args;
  }

  /**
   * Print help message
   */
  static printHelp(): void {
    const help = `
Schema Extractor - Refactor inline OpenAPI schemas to components

USAGE
  extract-inline-schemas [OPTIONS] <input-file> [output-file]

OPTIONS
  -h, --help                    Show this help message
  -v, --verbose                 Enable verbose logging
  --min-complexity=<number>     Minimum complexity to extract (default: 2)
  --max-depth=<number>          Maximum nesting depth (default: 10)
  --skip-paths=<patterns>       Comma-separated path patterns to skip
  --report=<file>               Save report to file
  --no-backup                   Don't create backup of input file
  --no-validate                 Skip validation after extraction

EXAMPLES
  # Basic usage
  extract-inline-schemas input.yaml

  # Save to different file
  extract-inline-schemas input.yaml output.yaml

  # Verbose mode with custom options
  extract-inline-schemas input.yaml --verbose --min-complexity=3 --max-depth=8

  # Skip internal paths and generate report
  extract-inline-schemas input.yaml \\
    --skip-paths='/internal/.*,/deprecated/.*' \\
    --report=extraction-report.md

  # Production mode (no backup, minimal logging)
  extract-inline-schemas input.yaml output.yaml --no-backup
`;
    console.log(help);
  }

  /**
   * Validate parsed arguments
   */
  static validate(args: CliArgs): { valid: boolean; error?: string } {
    if (!args.inputFile) {
      return { valid: false, error: 'Input file is required' };
    }

    if (args.minComplexity < 1) {
      return { valid: false, error: 'minComplexity must be >= 1' };
    }

    if (args.maxDepth < 1) {
      return { valid: false, error: 'maxDepth must be >= 1' };
    }

    return { valid: true };
  }
}
```

---

### **6. Main Execution Script**

```typescript name=extract-inline-schemas.ts url=https://github.com/elastic/kibana/tree/main/oas_docs/scripts/extract-inline-schemas.ts
#!/usr/bin/env node

/*
 * Copyright Elasticsearch B. V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements.  Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1". 
 */

import path from 'path';
import { SchemaExtractor, ConsoleLogger } from './lib/schema-extractor';
import { FileHandler } from './lib/file-handler';
import { ReportGenerator } from './lib/report-generator';
import { Validator } from './lib/validator';
import { CliHandler } from './lib/cli-handler';

/**
 * Main entry point for schema extraction
 */
async function main(): Promise<void> {
  const args = CliHandler.parseArgs(process.argv. slice(2));

  if (args.help) {
    CliHandler.printHelp();
    process.exit(0);
  }

  const validation = CliHandler.validate(args);
  if (!validation.valid) {
    console.error(`Error: ${validation.error}`);
    console.error('Use --help for usage information');
    process.exit(1);
  }

  const logger = new ConsoleLogger(args.verbose);
  const fileHandler = new FileHandler(logger);
  const reportGenerator = new ReportGenerator(logger);
  const validator = new Validator(logger);

  const startTime = Date.now();
  const metadata = {
    timestamp: new Date(),
    inputFile: args.inputFile,
    outputFile: args.outputFile || args.inputFile,
    duration: 0,
    success: false,
  };

  try {
    logger.info(`Schema Extractor v1.0.0`);
    logger.info('');

    // Create backup if requested
    if (args. backup) {
      fileHandler.createBackup(metadata. inputFile);
    }

    // Read input document
    const document = fileHandler.readOasDocument(metadata.inputFile);

    // Get pre-extraction stats
    const preStats = fileHandler.getFileStats(metadata.inputFile);

    // Extract schemas
    const extractor = new SchemaExtractor(
      {
        minComplexity: args.minComplexity,
        maxDepth: args.maxDepth,
        skipPaths:  args.skipPaths,
        verbose: args.verbose,
      },
      logger
    );

    const refactoredDocument = extractor.process(document);
    const stats = extractor.getStats();

    // Write output document
    const outputFile = metadata.outputFile || metadata.inputFile;
    fileHandler.writeOasDocument(refactoredDocument, outputFile);

    // Get post-extraction stats
    const postStats = fileHandler.getFileStats(outputFile);

    // Validate if requested
    let validationResult: any = null;
    if (args.validate) {
      logger.info('');
      validationResult = validator.validate(refactoredDocument);
      validator.printResults(validationResult);
    }

    // Generate reports
    logger.info('');
    const duration = Date.now() - startTime;
    metadata.duration = duration;
    metadata.success = ! validationResult || validationResult.valid;

    reportGenerator.printSummary(metadata, stats);

    // Save markdown report if requested
    if (args.reportFile) {
      const report = reportGenerator.generateMarkdownReport(
        metadata,
        stats,
        {
          inputSize: preStats.size,
          outputSize: postStats.size,
          inputLines: preStats.lines,
          outputLines: postStats.lines,
        }
      );
      reportGenerator.saveReport(report, args.reportFile);
    }

    // Clean up backups on success
    if (args.backup && metadata.success) {
      fileHandler.cleanupBackups(metadata.inputFile);
    }

    process.exit(metadata.success ? 0 : 1);
  } catch (error) {
    metadata.duration = Date.now() - startTime;
    metadata.success = false;

    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Extraction failed: ${errorMessage}`);

    if (args.verbose && error instanceof Error) {
      console.error(error.stack);
    }

    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

---

### **7. Index/Export File**

```typescript name=index. ts url=https://github.com/elastic/kibana/tree/main/oas_docs/scripts/lib/index.ts
/*
 * Copyright Elasticsearch B. V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements.  Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

export { SchemaExtractor, ConsoleLogger } from './schema-extractor';
export type { SchemaExtractionOptions, ExtractionStats, Logger } from './schema-extractor';

export { FileHandler } from './file-handler';

export { ReportGenerator } from './report-generator';
export type { ReportMetadata } from './report-generator';

export { Validator } from './validator';
export type { ValidationResult, ValidationError, ValidationWarning } from './validator';

export { CliHandler } from './cli-handler';
export type { CliArgs } from './cli-handler';
```

---

### **8. TypeScript Configuration**

```json name=tsconfig.json url=https://github.com/elastic/kibana/tree/main/oas_docs/scripts/tsconfig. json
{
  "compilerOptions": {
    "target":  "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop":  true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["lib/**/*.ts", "*. ts"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

---

### **9. Documentation**

```markdown name=README.md url=https://github.com/elastic/kibana/tree/main/oas_docs/scripts/README.md
# Schema Extraction Utilities

Post-processing utilities for extracting inline OpenAPI schemas to reusable components.

## Overview

These utilities provide a post-processing step for OpenAPI documents, extracting inline schemas from `oneOf`, `anyOf`, and `allOf` compositions and moving them to `components/schemas` with proper `$ref` pointers.

This approach: 
- ✓ Works with existing bundled OAS documents
- ✓ Doesn't require changes to the bundler package
- ✓ Can be integrated into CI/CD pipelines
- ✓ Supports comprehensive validation and reporting
- ✓ Preserves discriminators and complex schema structures

## Installation

```bash
# The utilities are provided as TypeScript files
# They can be executed with ts-node or compiled to JavaScript

# Install dependencies
yarn install

# Compile TypeScript
yarn build

# Or run directly with ts-node
yarn ts-node lib/extract-inline-schemas.ts
```

## Usage

### Basic Usage

```bash
# Extract schemas from a document
node oas_docs/scripts/extract-inline-schemas.js input.yaml

# Specify output file
node oas_docs/scripts/extract-inline-schemas.js input.yaml output.yaml

# With options
node oas_docs/scripts/extract-inline-schemas.js input.yaml output.yaml \
  --verbose \
  --min-complexity=3 \
  --max-depth=8
```

### Advanced Options

```bash
# Skip certain paths
node oas_docs/scripts/extract-inline-schemas. js input.yaml \
  --skip-paths='/internal/.*,/deprecated/.*'

# Generate detailed report
node oas_docs/scripts/extract-inline-schemas.js input.yaml \
  --report=extraction-report.md

# Production mode
node oas_docs/scripts/extract-inline-schemas. js input.yaml output.yaml \
  --no-backup \
  --no-validate
```

## Architecture

### Core Modules

1. **SchemaExtractor** (`schema-extractor.ts`)
   - Main extraction logic
   - Schema analysis and complexity calculation
   - Recursive schema traversal

2. **FileHandler** (`file-handler.ts`)
   - YAML file reading/writing
   - Backup management
   - File statistics

3. **ReportGenerator** (`report-generator.ts`)
   - Markdown report generation
   - Summary statistics
   - JSON export

4. **Validator** (`validator.ts`)
   - Post-extraction validation
   - Reference checking
   - Discriminator validation

5. **CliHandler** (`cli-handler.ts`)
   - Command-line argument parsing
   - User help and documentation

## API Reference

### SchemaExtractor

```typescript
const extractor = new SchemaExtractor({
  minComplexity:  2,        // Minimum complexity score
  maxDepth: 10,            // Maximum nesting depth
  namingPrefix: 'Generated', // Schema name prefix
  extractSingleItems: false, // Extract single oneOf/anyOf
  verbose: false,          // Verbose logging
  skipPaths: [],           // Paths to skip (regex patterns)
});

const refactored = extractor.process(document);
const stats = extractor.getStats();
```

### FileHandler

```typescript
const handler = new FileHandler(logger);

// Read/write
const doc = handler.readOasDocument('input.yaml');
handler.writeOasDocument(doc, 'output.yaml');

// Backups
const backupPath = handler.createBackup('input.yaml');
handler.cleanupBackups('input.yaml');

// Statistics
const stats = handler. getFileStats('file.yaml');
```

### Validator

```typescript
const validator = new Validator(logger);

const result = validator.validate(document);
if (!result.valid) {
  console.error('Validation failed:', result.errors);
}
```

## Examples

### Example 1: Basic Extraction

```typescript
import { SchemaExtractor, ConsoleLogger, FileHandler } from './lib';

const logger = new ConsoleLogger(true);
const fileHandler = new FileHandler(logger);

// Read document
const doc = fileHandler.readOasDocument('kibana.yaml');

// Extract schemas
const extractor = new SchemaExtractor(
  { minComplexity: 2, maxDepth: 10 },
  logger
);
const refactored = extractor. process(doc);

// Write result
fileHandler.writeOasDocument(refactored, 'kibana-refactored.yaml');

// Get statistics
const stats = extractor.getStats();
console.log(`Extracted ${stats.schemasExtracted} schemas`);
```

### Example 2: Full Pipeline with Validation

```typescript
import {
  SchemaExtractor,
  FileHandler,
  ReportGenerator,
  Validator,
  ConsoleLogger,
} from './lib';

const logger = new ConsoleLogger(true);
const fileHandler = new FileHandler(logger);
const reportGenerator = new ReportGenerator(logger);
const validator = new Validator(logger);

// Process
const doc = fileHandler.readOasDocument('input.yaml');
const extractor = new SchemaExtractor({ verbose: true }, logger);
const refactored = extractor.process(doc);

// Validate
const result = validator.validate(refactored);
if (!result.valid) {
  throw new Error('Validation failed');
}

//
