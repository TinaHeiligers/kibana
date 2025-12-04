[PR review automation] Provide feedback on PRs about health/quality of new OAS [github](https://github.com/elastic/kibana-team/issues/1971#issuecomment-3252401617)

**Rudolf Sept 4 2025**

> If we know what a valid route schema should be, we could compare the actual schemas per route to the valid one. I'm thinking along the lines of a route-schema-config package where we build on config-schema to generate a schema for the comparison and use the diff as a suggestion for fixing issues.

1. How would this work? How can we generate a valid route schema if we don't know what the schema should be?

> On the automation front, we need an easy way of detecting changes to registered routes in a core-owned file. Core would automatically be pinged for a codeowners review and we trigger an auto-review using whatever process we end up implementing.
> I've been leaning towards a route registry pattern similar to detecting changes to saved object definitions, where we create and store a hash for known routes (either at the domain level or at an individual route level ).

2. What problem would this try to solve?

--------------------------

1.
A valid schema is largely a set of rules that have to be followed, similar to the 'rules' that SO's need to follow w.r.t. `modelVersions`. For example, missing `description` errors contribute to validation errors, 

2. 
Kibana does **not** have a single, centralized "registry" file that lists all HTTP APIs in the codebase. Instead, HTTP APIs are typically registered within each plugin or service using the [Http Service](https://www.elastic.co/docs/extend/kibana/http-service) provided by the Kibana platform. Each plugin defines its own routes, usually in files like `server/routes.ts` or similar, and registers them during the plugin's setup phase.

There is **no master file** that aggregates all API endpoints across plugins. To discover all HTTP APIs, you generally need to:

- Explore each plugin's `server` directory for route registration code.
- Review the usage of the `router` object from the Http Service, which is used to define API endpoints.

For more details on how HTTP APIs are registered, see the [Kibana Http Service documentation](https://www.elastic.co/docs/extend/kibana/http-service) (2025-07-22).

**Summary:**  
- No single registry file for all HTTP APIs.
- APIs are registered per-plugin, typically in their own route files.
- Use the Http Service for route registration.

---

**Sources:**
- [Kibana Http Service documentation](https://www.elastic.co/docs/extend/kibana/http-service) (2025-07-22)
