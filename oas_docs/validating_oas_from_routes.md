# Route Schema Validation with OAS in Kibana

Based on my analysis of the codebase, I'll explain how route schemas are validated with respect to OAS (OpenAPI Specification) in Kibana.

## Route Schema Validation Process

Kibana has a comprehensive OAS validation system that works through several stages:

### 1. Route Registration and Schema Capture

Routes are registered using the Kibana HTTP service with validation schemas:

```typescript
router.post({
  path: '/api/my-endpoint',
  validationSchemas: {
    request: {
      body: schema.object({
        name: schema.string({ minLength: 1 }),
        description: schema.maybe(schema.string())
      }),
      params: schema.object({
        id: schema.string()
      })
    },
    response: {
      200: {
        body: schema.object({
          id: schema.string(),
          name: schema.string()
        })
      }
    }
  },
  options: {
    tags: ['access:myFeature'],
    description: 'Creates a new resource'
  }
}, handler);
```

### 2. OAS Snapshot Generation

The validation process begins with [`scripts/capture_oas_snapshot.js`](scripts/capture_oas_snapshot.js ), which:

1. Extracts route schemas from registered endpoints
2. Converts them to OpenAPI format using `@kbn/router-to-openapispec`
3. Generates `bundle.json` and `bundle.serverless.json` files

### 3. OAS Bundle Creation

The [`oas_docs`](oas_docs ) folder contains the bundling workflow:

- **`scripts/merge_ess_oas.js`**: Creates production ESS bundle
- **`scripts/merge_serverless_oas.js`**: Creates serverless bundle  
- **Output**: [`oas_docs/output/kibana.yaml`](oas_docs/output/kibana.yaml ) and [`oas_docs/output/kibana.serverless.yaml`](oas_docs/output/kibana.serverless.yaml )

### 4. OAS Validation with `@kbn/validate-oas`

The `@kbn/validate-oas` package performs comprehensive validation:

```typescript
// From index.ts
const validator = new Validator({ strict: false, allErrors: true });
const result = await validator.validate(yamlContent);

if (!result.valid && Array.isArray(result.errors)) {
  const errors = result.errors
    .filter(error => 
      // Filter out noise from $ref requirements
      error.params.missingProperty !== '$ref' &&
      error.params.z !== null
    )
    .map(({ instancePath, message }) => ({
      path: instancePath,
      message: message
    }));
}
```

## Validation Assertions and Examples

### Missing Descriptions

The validation specifically checks for missing descriptions in various OpenAPI components:

```yaml
# ❌ Invalid - Missing description
/api/fleet/agent_policies:
  get:
    summary: "Get agent policies"
    # Missing: description field
    
# ✅ Valid - Has description  
/api/fleet/agent_policies:
  get:
    summary: "Get agent policies" 
    description: "Retrieves a list of agent policies with optional filtering"
```

### Schema Structure Validation

The validator checks for proper OpenAPI schema structure:

```yaml
# ❌ Invalid - Malformed parameter schema
parameters:
  - name: id
    in: path
    # Missing: required field
    # Missing: schema definition

# ✅ Valid - Complete parameter schema
parameters:
  - name: id
    in: path
    required: true
    schema:
      type: string
    description: "Unique identifier for the resource"
```

### Response Schema Validation

```yaml
# ❌ Invalid - Missing response schema
responses:
  '200':
    # Missing: description and content schema

# ✅ Valid - Complete response schema  
responses:
  '200':
    description: "Successfully retrieved the resource"
    content:
      application/json:
        schema:
          type: object
          properties:
            id:
              type: string
            name:  
              type: string
```

## Validation Commands and CI Integration

### Manual Validation
```bash
# Validate OAS files
node ./scripts/validate_oas_docs.js

# Validate specific paths
node ./scripts/validate_oas_docs.js --path /paths/~1api~1fleet~1agent_policies

# Validate only serverless
node ./scripts/validate_oas_docs.js --only serverless

# Assert no error increase (CI usage)
node ./scripts/validate_oas_docs.js --assert-no-error-increase --update-baseline
```

### Baseline Error Tracking

The system maintains [`oas_error_baseline.json`](src/platform/packages/private/kbn-validate-oas/oas_error_baseline.json ) to track validation errors:

```json
{
  "./oas_docs/output/kibana.yaml": 313,
  "./oas_docs/output/kibana.serverless.yaml": 292  
}
```

### CI Pipeline Integration

From [`.buildkite/scripts/steps/checks/capture_oas_snapshot.sh`](.buildkite/scripts/steps/checks/capture_oas_snapshot.sh ):

```bash
echo "--- Capturing OAS snapshot"
node scripts/capture_oas_snapshot --include-path "/api" --include-path "/s/{space_id}"

echo "--- Validating OAS documents" 
node scripts/validate_oas_docs --assert-no-error-increase
```

## Common Validation Errors

Based on the codebase analysis, common validation errors include:

1. **Missing Descriptions**: Required for paths, parameters, responses
2. **Invalid Schema Types**: Incorrect or missing type definitions
3. **Missing Required Fields**: Like `required: true` for path parameters
4. **Malformed References**: Invalid `$ref` usage (though filtered as noise)
5. **Response Schema Issues**: Missing content-type definitions or schema objects
6. **Parameter Validation**: Missing `in`, `name`, or [`schema`](src/platform/packages/shared/kbn-config-schema/index.ts ) fields

The validation system helps ensure that Kibana's API documentation is complete, accurate, and follows OpenAPI 3.0 standards, which is critical for generating reliable API documentation for both ESS and Serverless offerings.
