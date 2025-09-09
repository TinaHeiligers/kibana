# Direct Route Validation for Kibana HTTP Routes

## Question

We need to answer the first question from Rudolf on Sept 4, 2025 about how to generate a valid route schema from HTTP routes in the kibana codebase in Automating_review_feedback.md and have possible ways to approach this based purely on already generated OAS from routes in base_valid_schema_generation and validating_OAS_from_routes. how would the approach change if at all, if we were to work directly on the routes themselves before they are converted to openapisspect in the package kbn-router-to-openapispec?

## Answer

Looking at your question about working directly with routes before they're converted to OpenAPI spec in `kbn-router-to-openapispec`, this would actually provide several advantages and change the approach significantly.

## Direct Route Validation vs OAS Post-Processing

### Current Flow
```
HTTP Routes → kbn-router-to-openapispec → OAS Document → Validation
```

### Proposed Flow
```
HTTP Routes → Direct Route Validation → Enhanced Routes → kbn-router-to-openapispec → OAS Document
```

## Advantages of Direct Route Validation

### 1. **Access to Rich Context**

Working with routes directly gives you access to the full [`InternalRouterRoute`](src/platform/packages/shared/kbn-router-to-openapispec/src/type.ts) object before conversion:

```typescript
// Direct route access provides:
interface RouteValidationContext {
  route: InternalRouterRoute;
  // Access to original validation schemas
  validationSchemas: RouteValidatorConfig<unknown, unknown, unknown>;
  // Route options with full context
  options: RouteConfigOptions<RouteMethod>;
  // Plugin context (if available)
  pluginId?: string;
  // File location for better error reporting
  sourceFile?: string;
}
```

### 2. **Better Error Reporting and Suggestions**

You can provide more actionable feedback by referencing the exact route registration code:

```typescript
function validateRouteSchema(route: InternalRouterRoute, sourceFile: string) {
  const issues: RouteValidationIssue[] = [];
  
  if (!route.options.description) {
    issues.push({
      severity: 'error',
      code: 'MISSING_DESCRIPTION',
      message: 'Route missing required description',
      suggestion: `Add description to route options:
router.${route.method}({
  path: '${route.path}',
  options: {
+   description: 'Brief description of what this endpoint does',
    // ...other options
  }
}, handler);`,
      location: {
        file: sourceFile,
        path: route.path,
        method: route.method
      }
    });
  }
  
  return issues;
}
```

### 3. **Schema-Aware Validation**

Direct access to [`@kbn/config-schema`](src/platform/packages/shared/kbn-config-schema/index.ts) validation schemas allows for more sophisticated checks:

```typescript
function validateSchemaCompleteness(route: InternalRouterRoute) {
  const validationSchemas = extractValidationSchemaFromRoute(route);
  const issues: RouteValidationIssue[] = [];
  
  if (validationSchemas?.body) {
    // Check if body schema has descriptions for complex objects
    const bodySchema = validationSchemas.body as any;
    if (isComplexObject(bodySchema) && !hasFieldDescriptions(bodySchema)) {
      issues.push({
        severity: 'warning',
        code: 'MISSING_FIELD_DESCRIPTIONS',
        message: 'Complex request body should include field descriptions',
        suggestion: generateSchemaWithDescriptions(bodySchema)
      });
    }
  }
  
  return issues;
}
```

## Enhanced Validation Approaches

### 1. **Pattern-Based Route Classification**

Classify routes before OAS conversion for targeted validation:

```typescript
function classifyRoute(route: InternalRouterRoute): RoutePattern {
  const path = route.path;
  const method = route.method;
  
  if (method === 'get' && path.includes('{id}')) {
    return 'RESOURCE_GET_BY_ID';
  } else if (method === 'post' && !path.includes('{')) {
    return 'RESOURCE_CREATE';
  } else if (method === 'put' && path.includes('{id}')) {
    return 'RESOURCE_UPDATE';
  }
  // ... more patterns
  
  return 'CUSTOM';
}

function getValidationRulesForPattern(pattern: RoutePattern): ValidationRule[] {
  const commonRules = [
    requireDescription,
    requireTags,
    requireResponseSchema
  ];
  
  switch (pattern) {
    case 'RESOURCE_GET_BY_ID':
      return [
        ...commonRules,
        requirePathParamDescriptions,
        requireNotFoundResponse,
        requireSuccessResponse
      ];
    case 'RESOURCE_CREATE':
      return [
        ...commonRules,
        requireRequestBodySchema,
        requireCreatedResponse,
        requireValidationErrorResponse
      ];
    // ... more patterns
  }
}
```

### 2. **Integration with Route Processing**

Modify [`processRouter`](src/platform/packages/shared/kbn-router-to-openapispec/src/process_router.ts) to include validation:

```typescript
// filepath: src/platform/packages/shared/kbn-router-to-openapispec/src/process_router.ts
export const processRouter = async ({
  appRouter,
  converter,
  getOpId,
  filters,
  env = { serverless: false },
}: ProcessRouterOptions) => {
  const paths: OpenAPIV3.PathsObject = {};
  if (filters?.version && filters.version !== SERVERLESS_VERSION_2023_10_31) return { paths };
  
  const routes = prepareRoutes(appRouter.getRoutes({ excludeVersionedRoutes: true }), filters);
  
  // Add route validation before processing
  const routeValidator = new RouteSchemaValidator();
  const validationResults = new Map<string, RouteValidationResult>();
  
  for (const route of routes) {
    try {
      // Validate route before OAS conversion
      const validationResult = routeValidator.validateRoute(route);
      validationResults.set(`${route.method}:${route.path}`, validationResult);
      
      // Only proceed if validation passes or warnings only
      if (validationResult.hasErrors && validationResult.shouldBlock) {
        console.warn(`Skipping route ${route.path} due to validation errors:`, 
          validationResult.errors);
        continue;
      }
      
      // Enhanced route processing with validation context
      const pathParams = getPathParameters(route.path);
      const validationSchemas = extractValidationSchemaFromRoute(route);
      
      // ... existing processing logic ...
      
      // Enhance operation with validation metadata
      const operation: CustomOperationObject = {
        // ... existing operation building ...
        
        // Add validation metadata for tooling
        'x-validation-status': validationResult.status,
        'x-validation-warnings': validationResult.warnings?.map(w => w.message)
      };
      
      // ... rest of existing logic
    } catch (e) {
      // Enhanced error reporting with validation context
      const validationContext = validationResults.get(`${route.method}:${route.path}`);
      e.message = `Error processing route '${route.path}': ${e.message}`;
      if (validationContext?.errors.length) {
        e.message += `\nValidation errors: ${validationContext.errors.map(err => err.message).join(', ')}`;
      }
      throw e;
    }
  }
  
  // Return both paths and validation results for tooling
  return { 
    paths, 
    validationResults: Object.fromEntries(validationResults) 
  };
};
```

### 3. **Pre-Conversion Schema Enhancement**

Enhance routes with missing information before OAS conversion:

```typescript
function enhanceRouteForOAS(route: InternalRouterRoute): InternalRouterRoute {
  const enhanced = { ...route };
  
  // Auto-generate descriptions based on patterns if missing
  if (!enhanced.options.description) {
    enhanced.options.description = generateDescriptionFromPattern(route);
  }
  
  // Auto-generate tags based on path structure
  if (!enhanced.options.tags?.length) {
    enhanced.options.tags = generateTagsFromPath(route.path);
  }
  
  // Enhance validation schemas with better examples
  if (enhanced.validationSchemas) {
    enhanced.validationSchemas = enhanceValidationSchemas(enhanced.validationSchemas);
  }
  
  return enhanced;
}
```

## Implementation Strategy

### 1. **Route Registry with Validation**

Create a route registry that validates on registration:

```typescript
class ValidatingRouteRegistry {
  private routes = new Map<string, ValidatedRoute>();
  private validator = new RouteSchemaValidator();
  
  registerRoute(route: InternalRouterRoute, sourceInfo: RouteSourceInfo) {
    const validationResult = this.validator.validateRoute(route, sourceInfo);
    
    this.routes.set(
      `${route.method}:${route.path}`, 
      {
        route,
        validationResult,
        sourceInfo,
        registeredAt: Date.now()
      }
    );
    
    // Emit validation events for tooling
    if (validationResult.hasErrors) {
      this.emit('validation-error', { route, validationResult });
    }
  }
  
  getValidationReport(): ValidationReport {
    // Generate comprehensive validation report
    return generateReport(Array.from(this.routes.values()));
  }
}
```

### 2. **CLI Integration**

Add validation to existing CLI tools:

```bash
# New validation commands
yarn kbn routes:validate                    # Validate all routes
yarn kbn routes:validate --plugin fleet    # Validate specific plugin
yarn kbn routes:enhance                     # Auto-enhance routes with missing info
yarn kbn routes:report                      # Generate validation report
```

## Benefits of Direct Route Validation

1. **Earlier Feedback**: Catch issues at route registration time
2. **Better Context**: Access to full route information and source locations  
3. **Actionable Suggestions**: Generate specific code fixes
4. **Pattern Recognition**: Classify and validate routes by common patterns
5. **Auto-Enhancement**: Automatically fill in missing information where possible
6. **Integration**: Seamlessly integrate with existing build and development workflows

This approach transforms the validation from a post-processing check to an integral part of the route development workflow, providing immediate feedback and guidance to
developers
