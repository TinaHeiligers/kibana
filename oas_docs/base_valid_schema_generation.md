# Generating a Valid Route Schema Baseline for OAS Validation

Yes, based on the information provided, there's a practical approach to generate an expected schema template that all routes can be compared against. This would address the question in the feedback document: "How can we generate a valid route schema if we don't know what the schema should be?"

## Implementing a Route Schema Generator

### 1. Create a Reference Schema Template

You could create a reference schema template based on the validation rules already enforced by the `@kbn/validate-oas` package:

```typescript
// Example of a reference schema structure
const routeReferenceSchema = {
  metadata: {
    required: ['description', 'tags'],
    optional: ['deprecated']
  },
  parameters: {
    structure: {
      required: ['name', 'in', 'required', 'schema', 'description']
    }
  },
  requestBody: {
    required: ['description', 'content'],
    content: {
      required: ['schema']
    }
  },
  responses: {
    required: ['200'],
    structure: {
      required: ['description', 'content'],
      content: {
        required: ['schema']
      }
    }
  }
};
```

### 2. Develop a Schema Diff Tool

Create a utility that compares a route's actual schema against the reference template:

```typescript
function compareRouteToReference(actualRoute, referenceSchema) {
  const issues = [];
  
  // Check metadata
  if (!actualRoute.description) {
    issues.push({
      severity: 'error',
      path: 'description',
      message: 'Missing required description'
    });
  }
  
  // Check parameters
  (actualRoute.parameters || []).forEach((param, index) => {
    if (!param.description) {
      issues.push({
        severity: 'error',
        path: `parameters[${index}].description`,
        message: 'Parameter missing required description'
      });
    }
    // More checks...
  });
  
  // More validation logic for responses, requestBody, etc.
  
  return issues;
}
```

## Integration with Existing Systems

You could integrate this with the current OAS validation pipeline:

### 1. Extend the OAS Validation Process

```typescript
// In scripts/validate_oas_docs.js
const routeSchemaValidator = require('@kbn/route-schema-validator');

// After standard OAS validation
const oasValidationIssues = await validateOas(oasDocument);

// Add schema template comparison
const schemaComparisonIssues = [];
Object.entries(oasDocument.paths).forEach(([path, pathItem]) => {
  Object.entries(pathItem).forEach(([method, operation]) => {
    const issues = routeSchemaValidator.compareRouteToReference(
      operation,
      routeReferenceSchema
    );
    schemaComparisonIssues.push(...issues.map(issue => ({
      ...issue,
      path: `${path}.${method}.${issue.path}`
    })));
  });
});

// Combine issues for reporting
const allIssues = [...oasValidationIssues, ...schemaComparisonIssues];
```

### 2. Automated PR Feedback

You could create a GitHub action that runs on PRs and comments with feedback:

```yaml
name: API Schema Validation
on:
  pull_request:
    paths:
      - '**/server/routes.ts'
      - '**/server/routes/**'

jobs:
  validate-routes:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run Route Schema Validation
        id: validate
        run: node scripts/validate_route_schemas.js
        
      - name: Comment on PR
        if: steps.validate.outputs.has_issues == 'true'
        uses: actions/github-script@v6
        with:
          script: |
            const issues = JSON.parse(process.env.ROUTE_ISSUES);
            const comment = formatRouteIssuesAsMarkdown(issues);
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
```

## Benefits of This Approach

1. **Standardization**: Enforces consistent API documentation across all routes
2. **Automation**: Provides immediate feedback during development
3. **Quality**: Improves OAS documentation quality over time
4. **Discoverability**: Makes APIs more discoverable and usable

## Implementation Strategy

1. First, create the reference schema template based on OpenAPI 3.0 standards and Kibana-specific requirements
2. Develop the comparison utility that generates actionable feedback
3. Integrate with the existing OAS validation pipeline
4. Add CI automation to provide feedback on PRs

This approach leverages existing validation logic while creating a positive template to compare against, rather than just detecting errors after they occur.


# Alternative Approaches for Route Schema Validation

Based on the current OAS validation processes in Kibana, here are two alternative approaches for generating valid schemas to compare routes against:

## Approach 1: Exemplar-Based Schema Generation

This approach identifies and leverages existing high-quality route definitions as templates:

### Implementation Strategy

1. **Identify Exemplars:**
   ```typescript
   function findExemplarRoutes(oasDocument) {
     // Score routes based on completeness criteria
     const scoredRoutes = Object.entries(oasDocument.paths).map(([path, pathObj]) => {
       return Object.entries(pathObj).map(([method, operation]) => {
         const score = calculateCompleteness(operation);
         return { path, method, operation, score };
       });
     }).flat();
     
     // Return top scoring routes for each category
     return groupByCategory(scoredRoutes).map(group => group.sort((a, b) => 
       b.score - a.score)[0]);
   }
   ```

2. **Pattern Classification:**
   - Categorize routes by pattern (CRUD, search, config, etc.)
   - Extract schema patterns from each exemplar
   - Create a library of typed templates

3. **Schema Matching:**
   - Match new/existing routes to closest exemplar pattern
   - Generate tailored validation rules based on the pattern
   - Highlight differences from the exemplar

### Benefits

- Uses real-world examples rather than abstract templates
- Adapts to different API styles in different parts of the codebase
- Provides concrete examples developers can reference

## Approach 2: Progressive Schema Enhancement

This approach builds schemas incrementally by analyzing route patterns and usage:

### Implementation Strategy

1. **Schema Mining and Analysis:**
   ```typescript
   // Extract common patterns from existing routes
   function mineSchemaPatterns(oasDocument) {
     const patterns = {
       parameters: new Map(),
       requestBodies: new Map(),
       responses: new Map()
     };
     
     // Analyze all routes to extract recurring patterns
     traverseRoutes(oasDocument, (path, method, operation) => {
       extractPatterns(operation, patterns);
     });
     
     return generatePatternLibrary(patterns);
   }
   ```

2. **Progressive Validation Layers:**
   - **Layer 1:** Essential structure validation (required fields exist)
   - **Layer 2:** Content validation (descriptions, examples)
   - **Layer 3:** Consistency validation (naming conventions, patterns)
   - **Layer 4:** Quality validation (comprehensive descriptions, error responses)

3. **Self-Improving System:**
   - Capture validation results over time
   - Identify evolving best practices
   - Automatically update schema requirements based on improving standards

### Integration Example

```typescript
// In validation pipeline
async function validateWithProgressiveEnhancement(route, baselineRequirements) {
  // Start with critical validation
  const criticalIssues = validateCriticalRequirements(route, baselineRequirements);
  
  // If critical validation passes, check enhancement opportunities
  const enhancements = criticalIssues.length === 0 ? 
    suggestEnhancements(route, baselineRequirements) : [];
    
  // Check for excellence criteria
  const excellenceSuggestions = criticalIssues.length === 0 ? 
    checkExcellenceCriteria(route) : [];
    
  return {
    valid: criticalIssues.length === 0,
    criticalIssues,
    enhancements,
    excellenceSuggestions
  };
}
```

### Benefits

- Provides a clear path to improvement
- Distinguishes between must-fix issues and enhancements
- Adapts to evolving API standards
- Creates a culture of continuous documentation improvement

## Implementation Considerations

Both approaches could be implemented with:

1. **Feedback-driven refinement loops:**
   - Collect developer feedback on validation results
   - Refine templates/patterns based on usage

2. **Integration with existing CI/PR flows:**
   - Add validation status to PR checks
   - Generate helpful, actionable comments

3. **Visual comparison tools:**
   - Show side-by-side comparisons of actual vs. ideal schemas
   - Highlight specific areas for improvement

These approaches move beyond simple validation to actively guide developers toward better API documentation practices.


# Summary of Schema Validation Approaches

Below is a summary of the three approaches described in this document for generating a valid schema to compare all routes against, along with their pros and cons, and a pragmatic recommendation for adoption.

## 1. Reference Schema Template (Baseline)

**Summary:**
Create a static reference schema template based on OpenAPI and Kibana-specific requirements. Compare each route's schema directly to this template using a diff tool.

**Pros:**
- Enforces strict, consistent standards across all routes
- Simple to implement and reason about
- Easy to automate and integrate into CI

**Cons:**
- May not accommodate legitimate variations in route patterns
- Can be rigid, requiring frequent updates as standards evolve
- Risk of false positives if the template is too strict or not kept up to date

## 2. Exemplar-Based Schema Generation

**Summary:**
Identify high-quality, real-world route schemas as exemplars. Categorize routes by pattern (CRUD, search, etc.), extract templates from exemplars, and compare new routes to the closest matching pattern.

**Pros:**
- Leverages proven, production-quality examples
- Adapts to different API styles and use cases
- Provides concrete, relatable guidance for developers

**Cons:**
- Requires initial and ongoing curation of exemplars
- May miss edge cases if exemplars are incomplete
- Can be harder to automate pattern matching and classification

## 3. Progressive Schema Enhancement

**Summary:**
Builds validation in layers: start with essential structure, then add content, consistency, and quality checks. Patterns are mined from the codebase and requirements evolve as standards improve.

**Pros:**
- Flexible and adaptive to evolving standards
- Encourages continuous improvement and documentation quality
- Distinguishes between critical issues and enhancements

**Cons:**
- More complex to implement and maintain
- May require more sophisticated tooling and feedback loops
- Initial validation may be less strict until higher layers are enforced

## Pragmatic Recommendation

Start with the **Reference Schema Template** approach to quickly establish a baseline of required fields and structure, ensuring immediate consistency and automation. In parallel, begin curating a set of high-quality exemplars and mining patterns from the codebase. Over time, evolve toward the **Progressive Schema Enhancement** model, layering in more nuanced checks and adapting requirements as the codebase and standards mature. This hybrid strategy provides fast wins, actionable feedback, and a clear path for continuous improvement.
