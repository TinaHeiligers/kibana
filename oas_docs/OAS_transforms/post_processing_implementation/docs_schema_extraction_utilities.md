Now I'll create comprehensive documentation for the schema extraction utilities:

## Schema Extraction Utilities Documentation

### **1. Main README**

````markdown name=oas_docs/scripts/README.md url=https://github.com/elastic/kibana/blob/main/oas_docs/scripts/README.md
# Schema Extraction Utilities

Tools for post-processing OpenAPI documents to refactor inline schemas into reusable components.

## Purpose

Extracts inline schemas from `oneOf`, `anyOf`, and `allOf` compositions and moves them to `#/components/schemas` with `$ref` pointers.  This solves client code generation issues while maintaining OpenAPI specification compliance.

## Quick Start

```bash
# Extract schemas from an OpenAPI document
node oas_docs/scripts/extract-inline-schemas.js input.yaml

# Save to a specific file
node oas_docs/scripts/extract-inline-schemas.js input.yaml output.yaml

# Verbose mode with custom options
node oas_docs/scripts/extract-inline-schemas.js input.yaml output.yaml \
  --verbose \
  --min-complexity=3 \
  --max-depth=8
```

## When to Use

- **After bundling**: Run after `kbn-openapi-bundler` completes
- **Before validation**: Extract before linting with Redocly
- **Standalone**: Process any OpenAPI YAML document independently

## File Structure

```
oas_docs/scripts/
├── lib/
│   ├── schema-extractor.ts      # Main extraction logic
│   ├── file-handler.ts          # YAML file operations
│   ├── report-generator.ts      # Report generation
│   ├── validator.ts             # Post-extraction validation
│   ├── cli-handler.ts           # CLI argument parsing
│   └── index.ts                 # Public exports
├── extract-inline-schemas.ts    # Entry point
└── test-schema-extraction.sh    # Test script
```

## How It Works

### Three-Phase Process

**Phase 1: Analysis**
- Traverses all paths and responses
- Identifies inline `oneOf`, `anyOf`, `allOf` compositions
- Calculates complexity score for each schema
- Marks schemas for extraction based on thresholds

**Phase 2: Replacement**
- Walks document structure again
- Replaces marked schemas with `$ref: #/components/schemas/{name}` pointers
- Preserves discriminators and other metadata

**Phase 3: Integration**
- Adds extracted schemas to `components/schemas`
- Ensures no name collisions
- Validates final document structure

## Configuration Options

### CLI Arguments

```bash
--min-complexity=<number>   # Minimum complexity score (default: 2)
--max-depth=<number>        # Maximum nesting depth (default: 10)
--skip-paths=<patterns>     # Comma-separated regex patterns to skip
--report=<file>             # Save report to file
--no-backup                 # Don't create . backup file
--no-validate               # Skip validation after extraction
--verbose                   # Enable detailed logging
```

### Complexity Calculation

Complexity is calculated based on:
- Number of composition items (×2 points each)
- Number of properties
- Nested compositions (×2 bonus)
- Presence of discriminator (×2 bonus)
- Base depth in document (×1)

Example:
```yaml
oneOf:
  - type: object
    properties:  { type: string, data: string }
  - type:  object
    properties: { type:  string, value: integer }
# Complexity = 1 (base) + 2 (items) + 2 (properties) = 5
```

## Integration with CI/CD

### Use in Makefile

```makefile
.PHONY: extract-schemas
extract-schemas:
	@node scripts/extract-inline-schemas.js \
		output/kibana.yaml \
		--verbose \
		--report=extraction-report.md
```

### Use in Merge Scripts

```javascript
// In merge_ess_oas.js
const { execSync } = require('child_process');

execSync('node oas_docs/scripts/extract-inline-schemas.js ' +
  'oas_docs/output/kibana.yaml --verbose');
```

### Use in CI Pipeline

```bash
#!/bin/bash
# Extract schemas after bundling
node oas_docs/scripts/extract-inline-schemas.js \
  oas_docs/output/kibana.yaml \
  --report=extraction-report.md

# Validate the result
npx @redocly/cli lint oas_docs/output/kibana.yaml
```

## Examples

### Example 1: Basic Extraction

```bash
node oas_docs/scripts/extract-inline-schemas.js kibana.yaml
```

**Input:**
```yaml
paths:
  /api/test:
    get:
      responses:
        '200':
          content:
            application/json: 
              schema:
                oneOf:
                  - type:  object
                    properties: 
                      type:  { type: string, enum: [typeA] }
                  - type: object
                    properties:
                      type: { type: string, enum: [typeB] }
```

**Output:**
```yaml
paths:
  /api/test: 
    get:
      responses: 
        '200':
          content:
            application/json: 
              schema:
                $ref: '#/components/schemas/GetTestResponse200'

components:
  schemas:
    GetTestResponse200:
      oneOf:
        - $ref: '#/components/schemas/GetTestResponse200A'
        - $ref: '#/components/schemas/GetTestResponse200B'
    GetTestResponse200A:
      type: object
      properties: 
        type:  { type: string, enum: [typeA] }
    GetTestResponse200B:
      type: object
      properties:
        type:  { type: string, enum: [typeB] }
```

### Example 2: With Report Generation

```bash
node oas_docs/scripts/extract-inline-schemas.js kibana.yaml \
  --report=extraction-report.md \
  --verbose
```

Generates a markdown report showing:
- Number of schemas extracted
- File size changes
- Composition type breakdown
- Discriminators preserved

### Example 3: Skipping Paths

```bash
node oas_docs/scripts/extract-inline-schemas.js kibana.yaml \
  --skip-paths='/internal/.*,/deprecated/.*,/s/.*'
```

Skips extraction for: 
- Any path starting with `/internal/`
- Any path starting with `/deprecated/`
- Spaces paths

### Example 4: Production Build

```bash
node oas_docs/scripts/extract-inline-schemas.js \
  oas_docs/output/kibana.yaml \
  oas_docs/output/kibana-final.yaml \
  --min-complexity=3 \
  --max-depth=8 \
  --no-backup
```

## Validation

The utility validates the extracted document for: 

### Critical Errors
- Missing `openapi` version field
- Missing `info` object
- Broken `$ref` pointers
- Invalid schema structure

### Warnings
- Empty schemas
- Incomplete discriminator mappings
- Schema references with sibling properties

Run validation explicitly: 
```bash
node oas_docs/scripts/extract-inline-schemas.js input.yaml --validate
```

Skip validation:
```bash
node oas_docs/scripts/extract-inline-schemas.js input.yaml --no-validate
```

## Composition Type Handling

### oneOf - Exactly One Valid

Used when exactly one option must match: 

```yaml
oneOf:
  - type: object
    properties:
      type: { enum: [email] }
      email:  { type: string }
  - type: object
    properties: 
      type: { enum: [phone] }
      phone: { type: string }
discriminator: 
  propertyName: type
```

Discriminator information is preserved during extraction.

### anyOf - One or More Valid

Used when one or more options can match:

```yaml
anyOf:
  - type: object
    properties: 
      id: { type: string }
  - type: object
    properties: 
      email: { type: string }
```

Less strict than `oneOf`; client generators handle differently.

### allOf - All Must Be Valid

Used for schema composition:

```yaml
allOf:
  - type: object
    properties:
      id: { type: string }
  - type: object
    properties: 
      metadata: { type: object }
```

Merges all schemas together.

## Naming Strategy

Extracted schemas use a hierarchical naming scheme:

```
{operationId}{Request|Response{statusCode}}
↓
GetUsersResponse200
CreateUserRequest
ListItemsResponse
```

Fallback if no `operationId`:

```
{Prefix}{Method}{StatusCode}
↓
GeneratedGET200
GeneratedPOST201
```

Uniqueness is guaranteed by appending counters: 

```
GetUsersResponse200
GetUsersResponse2001  ← if collision
GetUsersResponse2002  ← if another collision
```

## Performance Considerations

- **Depth Limit**: Default `maxDepth=10` prevents infinite recursion
- **Complexity Threshold**: Default `minComplexity=2` filters simple schemas
- **Single Pass**: Analysis and replacement happen in separate passes for efficiency
- **Memory**:  Suitable for documents up to several MB

## Troubleshooting

### "File not found" Error

```bash
node oas_docs/scripts/extract-inline-schemas.js /path/to/file.yaml
```

Ensure path is correct and file exists.

### No Schemas Extracted

Check complexity threshold:
```bash
# Lower threshold to extract simpler schemas
node oas_docs/scripts/extract-inline-schemas.js input.yaml \
  --min-complexity=1
```

Or verify document contains `oneOf`/`anyOf`/`allOf`:
```bash
grep -E 'oneOf|anyOf|allOf' input.yaml
```

### Validation Failures

Review the validation output: 
```bash
node oas_docs/scripts/extract-inline-schemas.js input.yaml \
  --verbose
```

Common issues:
- Broken references (fix `$ref` pointers)
- Missing components (ensure bundling completed)
- Invalid YAML syntax (validate with `yamllint`)

## API Usage

### In TypeScript

```typescript
import {
  SchemaExtractor,
  FileHandler,
  Validator,
  ConsoleLogger,
} from './lib';

const logger = new ConsoleLogger(true);
const handler = new FileHandler(logger);
const validator = new Validator(logger);

// Process document
const doc = handler.readOasDocument('input.yaml');
const extractor = new SchemaExtractor({
  minComplexity: 2,
  maxDepth: 10,
  verbose: true,
});

const refactored = extractor.process(doc);
const stats = extractor.getStats();

// Validate result
const result = validator.validate(refactored);

// Save output
handler.writeOasDocument(refactored, 'output.yaml');

console.log(`Extracted ${stats.schemasExtracted} schemas`);
```

### Library Import

```typescript
import { SchemaExtractor } from './lib';

const extractor = new SchemaExtractor({ verbose: true });
const result = extractor.process(document);
```

## Limitations

- **No circular reference handling**: Assumes document is already valid OpenAPI
- **Schema ordering**: Output schema order may differ from input
- **Custom keywords**: Preserves unknown YAML keywords but doesn't process them
- **Size**:  Not designed for documents > 50MB

## Related Tools

- **kbn-openapi-bundler**:  Bundles multiple OAS documents
- **Redocly CLI**: Validates OpenAPI specification
- **@hey-api/openapi-ts**:  Generates client code from OpenAPI specs

## Support

For issues, questions, or improvements: 
1. Check the troubleshooting section
2. Review generated reports for details
3. Run with `--verbose` for detailed output
4. Check server logs for integration issues
````

---

### **2. API Reference Guide**

````markdown name=oas_docs/scripts/lib/API. md url=https://github.com/elastic/kibana/blob/main/oas_docs/scripts/lib/API.md
# API Reference

## SchemaExtractor

Main class for extracting inline schemas from OpenAPI documents.

### Constructor

```typescript
new SchemaExtractor(options?: SchemaExtractionOptions, logger?: Logger)
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `minComplexity` | number | 2 | Minimum complexity score for extraction |
| `maxDepth` | number | 10 | Maximum nesting depth to analyze |
| `namingPrefix` | string | 'Generated' | Prefix for generated schema names |
| `extractSingleItems` | boolean | false | Extract single-item compositions |
| `verbose` | boolean | false | Enable verbose logging |
| `skipPaths` | string[] | [] | Regex patterns for paths to skip |
| `preserveOriginalNames` | boolean | false | Keep original names (unused) |

**Example:**

```typescript
const extractor = new SchemaExtractor({
  minComplexity: 3,
  maxDepth: 8,
  verbose: true,
  skipPaths: ['/internal/.*', '/deprecated/.*'],
});
```

### Methods

#### `process(document: OpenAPIV3.Document): OpenAPIV3.Document`

Processes an OpenAPI document and extracts inline schemas.

**Parameters:**
- `document`: The OpenAPI document to process

**Returns:** The refactored OpenAPI document with extracted schemas

**Example:**

```typescript
const input = yaml.load(fs.readFileSync('input.yaml', 'utf8'));
const output = extractor.process(input);
yaml.dump(output);
```

#### `getStats(): ExtractionStats`

Returns statistics from the last extraction.

**Returns:**

```typescript
{
  schemasExtracted: number;        // Total schemas moved to components
  compositionsFound: number;       // oneOf/anyOf/allOf found
  oneOfCount: number;              // oneOf compositions
  anyOfCount: number;              // anyOf compositions
  allOfCount: number;              // allOf compositions
  discriminatorsPreserved: number; // Discriminators kept
  maxDepthReached: number;         // Deepest nesting level
}
```

**Example:**

```typescript
const stats = extractor.getStats();
console.log(`Extracted ${stats.schemasExtracted} schemas`);
```

---

## FileHandler

Handles reading and writing OpenAPI YAML documents.

### Constructor

```typescript
new FileHandler(logger:  Logger)
```

### Methods

#### `readOasDocument(filePath: string): OpenAPIV3.Document`

Reads an OpenAPI document from a YAML file.

**Parameters:**
- `filePath`: Path to the YAML file

**Returns:** Parsed OpenAPI document

**Throws:** Error if file not found or YAML invalid

**Example:**

```typescript
const doc = fileHandler.readOasDocument('kibana.yaml');
```

#### `writeOasDocument(document: OpenAPIV3.Document, filePath: string): void`

Writes an OpenAPI document to a YAML file.

**Parameters:**
- `document`: The document to write
- `filePath`: Output file path

**Throws:** Error if write fails

**Example:**

```typescript
fileHandler.writeOasDocument(refactored, 'output.yaml');
```

#### `createBackup(filePath: string): string`

Creates a backup copy of the input file.

**Parameters:**
- `filePath`: Path to the file to backup

**Returns:** Path to the backup file (`.backup` extension)

**Example:**

```typescript
const backupPath = fileHandler.createBackup('input.yaml');
// Creates 'input.yaml.backup'
```

#### `cleanupBackups(filePath: string): void`

Removes backup files created by `createBackup()`.

**Parameters:**
- `filePath`: Original file path

**Example:**

```typescript
fileHandler.cleanupBackups('input.yaml');
```

#### `getFileStats(filePath: string): { size: string; lines: number }`

Gets file statistics.

**Parameters:**
- `filePath`: Path to file

**Returns:** Object with formatted size and line count

**Example:**

```typescript
const stats = fileHandler.getFileStats('output.yaml');
console.log(`File size: ${stats.size}, Lines: ${stats.lines}`);
// Output: File size: 245KB, Lines: 3456
```

#### `listYamlFiles(dirPath: string): string[]`

Lists all YAML files in a directory.

**Parameters:**
- `dirPath`: Directory path

**Returns:** Array of file paths

**Example:**

```typescript
const files = fileHandler.listYamlFiles('oas_docs/specs/');
```

---

## Validator

Validates OpenAPI documents after extraction.

### Constructor

```typescript
new Validator(logger: Logger)
```

### Methods

#### `validate(document: OpenAPIV3.Document): ValidationResult`

Validates a document structure and references.

**Parameters:**
- `document`: The document to validate

**Returns:**

```typescript
{
  valid: boolean;           // Overall validity
  errors: ValidationError[]; // Critical issues
  warnings: ValidationWarning[]; // Non-critical issues
}
```

**Error Structure:**

```typescript
{
  type: string;             // Error category
  message: string;          // Human-readable message
  location?:  string;        // Path in document
  severity:  'critical' | 'error';
}
```

**Example:**

```typescript
const result = validator.validate(document);
if (! result.valid) {
  result.errors.forEach(err => {
    console.error(`${err.type}: ${err.message}`);
  });
}
```

#### `printResults(result: ValidationResult): void`

Prints validation results to console. 

**Parameters:**
- `result`: Validation result from `validate()`

**Example:**

```typescript
const result = validator.validate(document);
validator.printResults(result);
```

---

## ReportGenerator

Generates reports and summaries. 

### Constructor

```typescript
new ReportGenerator(logger: Logger)
```

### Methods

#### `generateMarkdownReport(... ): string`

Generates a markdown formatted report.

**Parameters:**

```typescript
generateMarkdownReport(
  metadata: ReportMetadata,
  stats:  ExtractionStats,
  fileStats: {
    inputSize: string;
    outputSize: string;
    inputLines: number;
    outputLines: number;
  }
): string
```

**Returns:** Markdown report as string

**Example:**

```typescript
const report = reportGenerator.generateMarkdownReport(
  metadata,
  stats,
  fileStats
);
fs.writeFileSync('report.md', report);
```

#### `saveReport(report: string, outputPath: string): void`

Saves a report to file.

**Parameters:**
- `report`: Report content
- `outputPath`: Output file path

**Example:**

```typescript
reportGenerator.saveReport(report, 'extraction-report.md');
```

#### `generateJsonReport(... ): Record<string, unknown>`

Generates a JSON report.

**Parameters:** Same as `generateMarkdownReport()`

**Returns:** JSON object

**Example:**

```typescript
const json = reportGenerator.generateJsonReport(
  metadata,
  stats,
  fileStats
);
console.log(JSON.stringify(json, null, 2));
```

#### `printSummary(metadata: ReportMetadata, stats: ExtractionStats): void`

Prints a summary to console.

**Parameters:**
- `metadata`: Operation metadata
- `stats`: Extraction statistics

**Example:**

```typescript
reportGenerator.printSummary(metadata, stats);
```

---

## CliHandler

Handles command-line argument parsing. 

### Methods

#### `static parseArgs(argv: string[]): CliArgs`

Parses command-line arguments.

**Parameters:**
- `argv`: Process argv slice (process.argv. slice(2))

**Returns:**

```typescript
{
  inputFile: string;
  outputFile?:  string;
  verbose: boolean;
  minComplexity: number;
  maxDepth: number;
  backup: boolean;
  skipPaths: string[];
  reportFile?: string;
  validate: boolean;
  help: boolean;
}
```

**Example:**

```typescript
const args = CliHandler.parseArgs(process.argv. slice(2));
if (args.help) {
  CliHandler.printHelp();
  process.exit(0);
}
```

#### `static printHelp(): void`

Prints help message to console.

**Example:**

```typescript
CliHandler.printHelp();
```

#### `static validate(args: CliArgs): { valid: boolean; error?:  string }`

Validates parsed arguments.

**Parameters:**
- `args`: Parsed arguments from `parseArgs()`

**Returns:** Validation result

**Example:**

```typescript
const validation = CliHandler.validate(args);
if (!validation.valid) {
  console.error(`Error: ${validation.error}`);
  process.exit(1);
}
```

---

## Logger Interface

Custom logging interface for integration. 

```typescript
interface Logger {
  info(message: string): void;
  debug(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}
```

### ConsoleLogger

Built-in console-based logger implementation.

**Constructor:**

```typescript
new ConsoleLogger(verbose?:  boolean)
```

**Parameters:**
- `verbose`: Enable debug output

**Example:**

```typescript
const logger = new ConsoleLogger(true);
logger.info('Starting extraction');
logger.debug('Detailed information');
```

### Custom Logger

Implement the Logger interface for custom logging: 

```typescript
class CustomLogger implements Logger {
  info(message: string): void {
    // Custom logging
  }
  debug(message: string): void {}
  warn(message: string): void {}
  error(message:  string): void {}
}

const extractor = new SchemaExtractor({}, new CustomLogger());
```

---

## Type Definitions

### SchemaExtractionOptions

```typescript
interface SchemaExtractionOptions {
  minComplexity?:  number;
  maxDepth?:  number;
  namingPrefix?:  string;
  extractSingleItems?: boolean;
  verbose?: boolean;
  skipPaths?: string[];
  preserveOriginalNames?: boolean;
}
```

### ExtractionStats

```typescript
interface ExtractionStats {
  schemasExtracted: number;
  compositionsFound: number;
  oneOfCount: number;
  anyOfCount: number;
  allOfCount: number;
  discriminatorsPreserved: number;
  maxDepthReached: number;
}
```

### ValidationResult

```typescript
interface ValidationResult {
  valid: boolean;
  errors:  ValidationError[];
  warnings: ValidationWarning[];
}
```

### ValidationError

```typescript
interface ValidationError {
  type: string;
  message: string;
  location?: string;
  severity:  'critical' | 'error';
}
```

---

## Error Handling

All methods throw errors for exceptional conditions:

```typescript
try {
  const doc = fileHandler.readOasDocument('missing.yaml');
} catch (error) {
  if (error instanceof Error) {
    console.error(`Failed to read:  ${error.message}`);
  }
}
```

Common errors:
- `File not found`: Invalid file path
- `YAML parse error`: Malformed YAML
- `Invalid schema`: Document structure issues
````

---

### **3. Integration Guide**

````markdown name=oas_docs/scripts/INTEGRATION.md url=https://github.com/elastic/kibana/blob/main/oas_docs/scripts/INTEGRATION.md
# Integration Guide

Instructions for integrating schema extraction into your CI/CD pipeline and build process.

## Makefile Integration

Add targets to `oas_docs/makefile`:

```makefile
.PHONY: extract-schemas
extract-schemas:  ## Extract inline schemas to components
	@node scripts/extract-inline-schemas.js \
		output/kibana. yaml \
		--verbose \
		--report=extraction-report.md

.PHONY: extract-schemas-only
extract-schemas-only: ## Extract schemas without full rebuild
	@node scripts/extract-inline-schemas.js \
		output/kibana.yaml \
		--skip-paths='/internal/.*' \
		--no-backup

.PHONY: api-docs
api-docs: merge-api-docs extract-schemas api-docs-overlay space-aware-api-docs
```

Usage: 

```bash
cd oas_docs
make extract-schemas
make api-docs  # Includes extraction
```

## Merge Script Integration

Modify `oas_docs/scripts/merge_ess_oas.js`:

```javascript
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

(async () => {
  try {
    // ...  existing merge logic ... 

    // New: Extract inline schemas
    console.log(chalk.cyan('Extracting inline schemas...'));
    try {
      execSync(
        `node ${path.join(__dirname, 'extract-inline-schemas.js')} ` +
        `${path.join(__dirname, 'output', 'kibana.yaml')} ` +
        `--verbose`,
        { stdio: 'inherit' }
      );
      console.log(chalk.green('✓ Schema extraction completed'));
    } catch (error) {
      console.warn(chalk.yellow('⚠ Schema extraction encountered issues'));
      // Don't fail the entire build
    }

    // Continue with overlays and validation
  } catch (error) {
    console.error(chalk.red('Error: '), error.message);
    process.exit(1);
  }
})();
```

## CI/CD Pipeline Integration

### GitHub Actions

```yaml
name: API Docs Generation

on:
  push:
    branches: [main]

jobs:
  api-docs:
    runs-on: ubuntu-latest
    steps: 
      - uses: actions/checkout@v3

      - name: Install dependencies
        run: |
          cd oas_docs
          npm install

      - name: Bundle OpenAPI specs
        run: |
          cd oas_docs
          node scripts/merge_ess_oas.js
          node scripts/merge_serverless_oas.js

      - name: Extract inline schemas
        run: |
          cd oas_docs
          node scripts/extract-inline-schemas.js output/kibana.yaml \
            --report=extraction-report.md --verbose

      - name: Validate OpenAPI
        run: |
          cd oas_docs
          npx @redocly/cli lint output/*. yaml \
            --config linters/redocly.yaml

      - name: Upload artifacts
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: api-docs
          path: |
            oas_docs/output/
            oas_docs/extraction-report.md
```

### Buildkite

```bash
#!/bin/bash
set -euo pipefail

echo "--- Bundling OpenAPI specs"
node oas_docs/scripts/merge_ess_oas.js

echo "--- Extracting inline schemas"
node oas_docs/scripts/extract-inline-schemas. js \
  oas_docs/output/kibana.yaml \
  --report=extraction-report.md \
  --verbose

echo "--- Validating OpenAPI"
npx @redocly/cli lint oas_docs/output/*.yaml \
  --config oas_docs/linters/redocly.yaml

echo "--- Upload reports"
buildkite-agent artifact upload "extraction-report.md"
```

## Node.js Script Integration

```javascript
const path = require('path');
const {
  SchemaExtractor,
  FileHandler,
  Validator,
  ConsoleLogger,
} = require('./lib/schema-extractor');

async function extractAndValidate(inputFile, outputFile) {
  const logger = new ConsoleLogger(true);
  const fileHandler = new FileHandler(logger);
  const validator = new Validator(logger);

  try {
    // Read document
    const document = fileHandler.readOasDocument(inputFile);

    // Extract schemas
    const extractor = new SchemaExtractor(
      {
        minComplexity: 2,
        maxDepth: 10,
        verbose: true,
      },
      logger
    );

    const refactored = extractor.process(document);
    const stats = extractor.getStats();

    // Validate
    const result = validator.validate(refactored);
    validator.printResults(result);

    if (!result.valid) {
      throw new Error('Validation failed');
    }

    // Write output
    fileHandler.writeOasDocument(refactored, outputFile);
    logger.info(`Success: ${stats.schemasExtracted} schemas extracted`);

    return { success: true, stats };
  } catch (error) {
    logger.error(`Failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Execute
extractAndValidate('input.yaml', 'output.yaml')
  .then(result => {
    process.exit(result.success ? 0 : 1);
  });
```

## Npm Scripts Integration

Update `package.json` in `oas_docs/` directory:

```json
{
  "scripts": {
    "bundle: oas": "node scripts/merge_ess_oas.js && node scripts/merge_serverless_oas.js",
    "extract: schemas": "node scripts/extract-inline-schemas.js output/kibana.yaml --verbose",
    "validate:oas": "redocly lint output/*.yaml",
    "build:api-docs": "npm run bundle:oas && npm run extract:schemas && npm run validate: oas",
    "publish:api-docs": "bump deploy output/kibana.yaml --token $BUMP_TOKEN"
  }
}
```

Usage:

```bash
npm run bundle:oas
npm run extract: schemas
npm run validate:oas
npm run build:api-docs
```

## Docker Integration

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY oas_docs/ ./oas_docs/
COPY package.json yarn.lock ./

RUN cd oas_docs && npm install

ENTRYPOINT ["node", "oas_docs/scripts/extract-inline-schemas.js"]
```

Usage:

```bash
docker build -t kibana-oas-extractor .
docker run kibana-oas-extractor input.yaml output.yaml --verbose
```

## Options and Flags

### Development

```bash
# With detailed logging and validation
node scripts/extract-inline-schemas.js input.yaml output.yaml \
  --verbose \
  --min-complexity=1 \
  --max-depth=15
```

### Production

```bash
# Minimal output, no backup, maximum performance
node scripts/extract-inline-schemas.js \
  oas_docs/output/kibana.yaml \
  oas_docs/output/kibana-final.yaml \
  --no-backup \
  --min-complexity=3 \
  --max-depth=8
```

### Testing

```bash
# Full validation and reporting
node scripts/extract-inline-schemas.js input.yaml output.yaml \
  --verbose \
  --validate \
  --report=test-report.md
```

## Error Handling

Wrap execution with error handling:

```bash
#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INPUT="${SCRIPT_DIR}/output/kibana.yaml"
OUTPUT="${SCRIPT_DIR}/output/kibana-refactored.yaml"

if !  node "${SCRIPT_DIR}/extract-inline-schemas.js" \
  "$INPUT" "$OUTPUT" \
  --verbose \
  --report="${SCRIPT_DIR}/extraction-report.md"; then
  echo "✗ Schema extraction failed"
  exit 1
fi

echo "✓ Schema extraction completed"
```

## Monitoring and Logging

Capture and monitor execution:

```bash
#!/bin/bash

LOGFILE="extraction-$(date +%Y%m%d-%H%M%S).log"

node scripts/extract-inline-schemas. js input.yaml output. yaml \
  --verbose \
  --report=extraction-report.md \
  2>&1 | tee "$LOGFILE"

EXIT_CODE=$?

# Parse report for metrics
if [ -f extraction-report.md ]; then
  EXTRACTED=$(grep "Schemas Extracted" extraction-report.md | \
    grep -oE '[0-9]+' | head -1)
  echo "Metrics: $EXTRACTED schemas extracted"
fi

exit $EXIT_CODE
```

## Conditional Execution

Run extraction only on specific conditions:

```bash
#!/bin/bash

# Only extract if OpenAPI docs changed
if git diff --name-only | grep -q "oas_docs/"; then
  echo "OpenAPI changed, extracting schemas..."
  node oas_docs/scripts/extract-inline-schemas.js \
    oas_docs/output/kibana.yaml \
    --verbose
else
  echo "No OpenAPI changes, skipping extraction"
fi
```

## Parallel Processing

For multiple documents:

```bash
#!/bin/bash

for file in oas_docs/output/*.yaml; do
  echo "Processing $(basename $file)..."
  node oas_docs/scripts/extract-inline-schemas.js \
    "$file" \
    "${file%. yaml}-refactored.yaml" &
done

wait
echo "All extractions complete"
```
````

---

### **4. Troubleshooting Guide**

````markdown name=oas_docs/scripts/TROUBLESHOOTING.md url=https://github.com/elastic/kibana/blob/main/oas_docs/scripts/TROUBLESHOOTING.md
# Troubleshooting Guide

Common issues and solutions when using schema extraction utilities.

## File Issues

### "File not found" Error

**Problem:**
```
Error: File not found: /path/to/file.yaml
```

**Solution:**
1. Verify file path is correct
2. Check file exists:  `ls -la /path/to/file.yaml`
3. Ensure full absolute path is used
4. Check file permissions: `chmod 644 file.yaml`

**Example:**
```bash
# ✗ Wrong
node scripts/extract-inline-schemas.js kibana.yaml

# ✓ Correct
node scripts/extract-inline-schemas.js $(pwd)/oas_docs/output/kibana.yaml
```

### YAML Parse Error

**Problem:**
```
Error: YAML parse error in input. yaml:  bad indentation of mapping entry
```

**Solution:**
1.  Validate YAML syntax: `yamllint input.yaml`
2. Check for tab characters: `grep -P '\t' input.yaml`
3. Review line with reported error
4. Use YAML online validator at https://www.yamllint.com/

**Example:**
```bash
# Install yamllint
npm install -g yamllint

# Validate file
yamllint input.yaml
```

## Extraction Issues

### No Schemas Extracted

**Problem:**
```
Schema extraction complete: 0 schemas extracted from 0 compositions
```

**Cause:** Document doesn't contain `oneOf`, `anyOf`, or `allOf`, or all are below complexity threshold.

**Solution:**
```bash
# Check if document has compositions
grep -E 'oneOf|anyOf|allOf' input.yaml | head -5

# Lower complexity threshold
node scripts/extract-inline-schemas. js input.yaml \
  --min-complexity=1 --verbose
```

### Wrong Schemas Extracted

**Problem:** Extraction happens in wrong locations or skips expected schemas.

**Solution:**
1. Run with verbose mode to see analysis:  `--verbose`
2. Check complexity calculation: Each schema shows complexity in logs
3. Review with `--min-complexity=1` to see what's available
4. Verify document structure is valid OpenAPI

**Example:**
```bash
node scripts/extract-inline-schemas. js input.yaml \
  --verbose \
  --report=debug-report.md
```

Review the report to see: 
- Which paths were analyzed
- Complexity scores assigned
- Why certain schemas were skipped

### Schema Name Collisions

**Problem:** Same schema name used multiple times

**Solution:**
This is handled automatically with numeric suffixes, but indicates: 
1. Multiple similar endpoints with same naming
2. Consider renaming endpoints with `operationId`
3. Check for duplicate endpoint definitions

**Example output:**
```
GetUsersResponse200
GetUsersResponse2001  ← Auto-suffixed
GetUsersResponse2002  ← Auto-suffixed
```

## Validation Issues

### Validation Failed:  Broken References

**Problem:**
```
✗ Validation failed with 1 error(s)
Errors:
  • [broken_reference] Reference to undefined schema:  #/components/schemas/Unknown at paths./api/test. get. responses.200.content.application/json. schema
```

**Solution:**
1. Verify all `$ref` pointers are correct
2. Check schema names in `components/schemas`
3. Ensure extraction completed successfully
4. Run with `--verbose` to see extraction details

**Example:**
```bash
# Check for undefined references
grep -o '\$ref: [^"]*' output. yaml | sort -u

# Check available schemas
grep -A 5 'components: ' output.yaml | grep -o '^\s\+[A-Za-z].*: ' | sed 's/://g' | tr -d ' '
```

### Validation Failed: Missing Info

**Problem:**
```
✗ Validation failed with 1 error(s)
Errors:
  • [missing_info] Missing info object
```

**Solution:**
1. Ensure input document is valid OpenAPI with `info` section
2. Check bundling completed successfully
3. Verify document wasn't corrupted during processing

**Example fix:**
```yaml
# Ensure your document has: 
openapi: 3.0.3
info:
  title:  Kibana API
  version: 2024-01-15
```

### Discriminator Mapping Invalid

**Problem:**
```
⚠ Warning: [invalid_discriminator_mapping] Discriminator mapping references undefined schema
```

**Solution:**
1. Check discriminator references existing schemas
2. Ensure schema names are spelled correctly
3. Run with `--verbose` to see discriminator handling

**Example:**
```yaml
# ✗ Wrong - references non-existent schema
oneOf:
  - $ref: '#/components/schemas/Cat'
  - $ref: '#/components/schemas/Dog'
discriminator: 
  propertyName: kind
  mapping: 
    cat: '#/components/schemas/Cat'
    dog: '#/components/schemas/DogsSchema'  # ✗ Typo

# ✓ Correct
mapping:
  cat: '#/components/schemas/Cat'
  dog: '#/components/schemas/Dog'
```

## Performance Issues

### Slow Extraction

**Problem:** Extraction takes a long time

**Solution:**
1.  Reduce `maxDepth` for large documents
2. Skip unnecessary paths:  `--skip-paths='/internal/.*'`
3. Increase `minComplexity` to extract fewer schemas
4. Check system resources (disk I/O, memory)

**Example:**
```bash
# For large documents (>10MB)
node scripts/extract-inline-schemas.js input.yaml \
  --max-depth=5 \
  --min-complexity=5 \
  --skip-paths='/internal/.*,/deprecated/.*'
```

### Memory Issues

**Problem:** Process runs out of memory

**Solution:**
1. Increase Node.js heap size: `NODE_OPTIONS="--max-old-space-size=4096"`
2. Break large documents into smaller parts
3. Process in batches instead of all at once

**Example:**
```bash
# Increase Node memory to 4GB
NODE_OPTIONS="--max-old-space-size=4096" \
  node scripts/extract-inline-schemas.js input.yaml
```

## Output Issues

### Invalid Output YAML

**Problem:** Output file is malformed YAML

**Solution:**
1. Validate output:  `yamllint output.yaml`
2. Check if extraction corrupted document
3. Compare input and output line counts
4. Run with `--no-validate` flag to bypass validation

**Recovery:**
```bash
# Restore from backup
cp input.yaml. backup input.yaml

# Try with safer options
node scripts/extract-inline-schemas.js input.yaml output.yaml \
  --min-complexity=5 \
  --max-depth=8
```

### File Size Changes

**Problem:** Output is significantly larger/smaller than expected

**Explanation:**
- Larger: Many deeply nested schemas moved to top level
- Smaller: Duplication removed through references
- Both are normal

**Verify:**
```bash
# Compare file sizes
ls -lh input.yaml output.yaml

# Compare line counts
wc -l input.yaml output.yaml

# Check schema count
grep -c '^  [A-Za-z].*:$' output.yaml | head -1
```

## Integration Issues

### Script Not Found

**Problem:**
```
bash: node: command not found
or
node: not found:  oas_docs/scripts/extract-inline-schemas.js
```

**Solution:**
1. Verify Node.js is installed: `node --version`
2. Check script file exists
3. Use correct path (absolute or relative)
4. Ensure execute permissions:  `chmod +x script.js`

**Example:**
```bash
# Check Node installation
which node
node --version  # Should be v14+

# List available scripts
ls -la oas_docs/scripts/

# Run with absolute path
/usr/local/bin/node /path/to/script.js
```

### Module Import Errors

**Problem:**
```
Error: Cannot find module './lib/schema-extractor'
```

**Solution:**
1. Install dependencies: `npm install` in `oas_docs/` directory
2. Check file structure matches expected paths
3. Verify TypeScript compilation completed
4. Check for case sensitivity issues in imports

**Example:**
```bash
cd oas_docs
npm install
npm run build  # If TypeScript needs compilation
```

### Backup Not Created

**Problem:** Backup file not created

**Solution:**
1. This is expected - backups are created with `--no-backup` NOT specified
2. Check if backup already exists
3. Verify write permissions to directory
4. Check disk space availability

**Example:**
```bash
# Default:  creates . backup file
node scripts/extract-inline-schemas.js input.yaml output. yaml

# Skip backup explicitly
node scripts/extract-inline-schemas.js input.yaml output. yaml --no-backup

# Check for backup
ls -la input.yaml*
```

## Report Issues

### Report Not Generated

**Problem:** Report file not created despite `--report` flag

**Solution:**
1. Check if `--report` path is writable
2. Verify path is absolute or relative to working directory
3. Check directory exists or use absolute path
4. Run with `--verbose` to see I/O operations

**Example:**
```bash
# Use absolute path
node scripts/extract-inline-schemas.js input.yaml output.yaml \
  --report=$(pwd)/extraction-report.md

# Or ensure directory exists
mkdir -p reports
node scripts/extract-inline-schemas.js input.yaml output. yaml \
  --report=reports/extraction-report.md
```

### Report Shows Incorrect Statistics

**Problem:** Report statistics don't match expected results

**Solution:**
1. Check extraction actually completed (no errors)
2. Verify input document contains expected compositions
3. Check `minComplexity` setting isn't filtering schemas
4. Run extraction again with `--verbose` for detailed output

## Getting Help

1. **Enable verbose logging**: `--verbose` flag shows detailed operation steps
2. **Generate report**: `--report=file.md` creates detailed analysis
3. **Check logs**: Review console output for specific errors
4. **Validate input**: Use `yamllint` to ensure input is valid YAML
5. **Test simple case**: Create minimal test document to isolate issue

### Minimal Test Case

```bash
# Create test file
cat > test.yaml << 'EOF'
openapi: 3.0.3
info:
  title: Test
  version: 1.0.0
paths:
  /test:
    get:
      responses:
        '200':
          description: OK
          content:
            application/json: 
              schema:
                oneOf:
                  - type: object
                    properties: 
                      id:  { type: string }
                  - type: object
                    properties:
                      name: { type: string }
EOF

# Test extraction
node oas_docs/scripts/extract-inline-schemas.js test.yaml \
  --verbose \
  --report=test-report.md
```

If this works, your setup is functional. Debug from there. 
````

---

These documentation files provide a solid foundation for users to understand, use, and integrate the schema extraction utilities. 
