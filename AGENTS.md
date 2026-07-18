# Kibana

## Setup
- Run `yarn kbn bootstrap` for initial setup, after switching branches, or when encountering dependency errors

## Overview
- Kibana is organized into modules, each defined by a `kibana.jsonc`: core, packages, and plugin packages. Aside from tooling and testing, most code lives in these modules.
- Packages are reusable units with explicit boundaries and a single public entry point (no subpath imports), usually with a focused purpose.
- Plugins are a package type (`type: "plugin"`) that include a plugin class with setup/start/stop lifecycles, utilized by the core platform to enable applications.
- **Server plugin entry (`server/index.ts`)** should not load `./plugin` until the plugin may run. Use `import type` (and `export type`) for types from `./plugin`, keep shared config in `config.ts` / `../common/config` (not re-exported runtime values from `./plugin` at the entry), and instantiate the implementation with `await import('./plugin')` inside the async `plugin` initializer. Static value imports, `export { … }` / `export *` of values, `import './plugin'`, and `require('./plugin')` in that entry force Node to parse and execute `plugin.ts` even when the plugin is disabled. `@kbn/eslint/no_sync_import_from_plugin` in `@kbn/eslint-config` enforces this on plugin `server/index.ts` files (see [PR #170856](https://github.com/elastic/kibana/pull/170856) and [issue #171080](https://github.com/elastic/kibana/issues/171080)).
- Plugins that depend on other plugins rely on the contracts returned by those lifecycles, so circular dependencies must be avoided.
- Module IDs (typically `@kbn/...`) live in `kibana.jsonc`; `package.json` names are derived where present.
- Plugin IDs are additional camelCase IDs under `plugin.id` in `kibana.jsonc`, used by core platform and other plugins.
- Modules are grouped by domain (platform vs solutions) with visibility rules (`shared` vs `private`) that limit cross-group access.
- Utility scripts live in `scripts/` (e.g., `node scripts/generate.js`).
- If a user correction contradicts this doc or any skills you followed, or missing guidance caused avoidable work, submit DevEx feedback: `echo "..." | scripts/devex_feedback.sh` (include the gap and suggested fix).

## Testing
Run `node scripts/check.js --scope=local|staged|branch` to validate changes (Jest, types, linting).

### Jest unit
`node scripts/jest [--config=<pathToConfigFile>] [TestPathPattern]`
- Config is auto-discovered from the test file path (walks up to nearest `jest.config.js`). Simplest usage:
  `node scripts/jest src/core/packages/http/server-internal/src/http_server.test.ts`
- Only one `--config` per run. To test multiple packages, run separate commands.

### Jest integration
`node scripts/jest_integration [--config=<pathToConfigFile>] [TestPathPattern]`
- Auto-discovers `jest.integration.config.js` (not `jest.config.js`). Same single-config constraint as above.

### Function Test Runner (FTR)
`node scripts/functional_tests [--config <file1> [--config <file2> ...]]`
- For new tests, prefer using Scout

### Scout (UI/API with Playwright)
`node scripts/scout run-tests --arch stateful --domain classic --config <scoutConfigPath>` (or `--testFiles <specPath1,specPath2>`)

## Code Style Guidelines
Follow existing patterns in the target area first; below are common defaults.

### Type check
`node scripts/type_check [--project path/to/tsconfig.json]`
- Without `--project` it checks **all** projects (very slow). Always scope to a single project:
  `node scripts/type_check --project src/core/packages/http/server-internal/tsconfig.json`
- Only one `--project` per run. To check multiple packages, run separate commands.
- `.buildkite/` is **not** a valid target for `scripts/type_check`. Buildkite scripts live in a separate workspace; typecheck them with `npm run typecheck` (or `yarn typecheck`) from inside `.buildkite/`.

### TypeScript & Types
- Use TypeScript for all new code; avoid `any` and `unknown`.
- Prefer explicit return types for public APIs and exported functions.
- Use `import type` for type-only imports.
- Avoid non-null assertions (`!`) unless locally justified.
- Prefer `readonly` and `as const` for immutable structures.
- Prefer const arrow functions
- Prefer explicit import/exports over "*"
- Prefer destructuring of variables, rather than property access
- Never suppress type errors with `@ts-ignore`, `@ts-expect-error`; fix the root cause.

### Linting
`node scripts/eslint --fix $(git diff --name-only)`
- Never suppress linting errors with `eslint-disable`; fix the root cause.
- Plugin `server/index.ts` files are checked by `@kbn/eslint/no_sync_import_from_plugin` (see plugin server entry note above).

### Formatting
- Follow existing formatting in the file; do not reformat unrelated code.
- Prefer single quotes in TS/JS unless the file uses double quotes.

### Naming
- `PascalCase` for classes, types, and React components.
- `camelCase` for functions, variables, and object keys.
- New filenames must be `snake_case` (lowercase with underscores) unless an existing convention requires otherwise.
- Use descriptive names; avoid single-letter names outside tight loops.

### Control Flow & Error Handling
- Prefer early returns and positive conditions.
- Handle errors explicitly; return typed errors from APIs when possible.
- Keep async logic linear; avoid nested `try` blocks when possible.

### React / UI Conventions
- Use functional components; type props explicitly.
- Keep hooks at the top level; avoid conditional hooks.
- Avoid inline styles unless consistent with the file’s conventions.
- Use `@elastic/eui` components with Emotion (`@emotion/react`) for styling.

## Internationalization (i18n)
- Guidelines are found in src/platform/packages/shared/kbn-i18n/GUIDELINE.md
- Run `node scripts/i18n_check --fix` to check for and fix errors.

## CI
- Use the `bk` CLI when interacting with Buildkite.

## Contribution Hygiene
- Unsure: read more code; if still stuck, ask w/ short options. Never guess.
- Fix root cause (not band-aid).
- Make focused changes; avoid unrelated refactors.
- Update docs and tests when behavior or usage changes.
- Never remove, skip, or comment out tests to make them pass; fix the underlying code.

## Cursor Cloud specific instructions
Kibana requires Node `24.18.0` (see `.nvmrc`). The VM has an `/exec-daemon/node` (Node 22) shim that shadows `nvm` in `PATH`, so the startup update script and `~/.bashrc` prepend the nvm Node 24 bin dir. In new interactive shells `node -v` should already be `v24.18.0`; if it isn't, run `export PATH="$NVM_DIR/versions/node/v24.18.0/bin:$PATH"` before any `yarn`/`node scripts/*` command (otherwise tooling silently runs under Node 22).

Running the stack (two long-lived services, best in separate tmux sessions):
- Elasticsearch: `yarn es snapshot --license trial -E discovery.type=single-node` (listens on `:9200`, creds `elastic` / `changeme`).
- Kibana dev server: `NODE_OPTIONS="--max-old-space-size=8192" yarn start --no-base-path` (listens on `:5601`, same creds). Start ES first. First boot builds ~222 optimizer bundles and takes several minutes.
- The larger `NODE_OPTIONS` heap is required: without it the optimizer worker OOMs (V8 ~4GB default) while building big bundles like `lens`/`securitySolution`.

Non-obvious gotcha — "Elastic did not load properly" after a crash: if a `yarn start` is interrupted (e.g. optimizer OOM), a bundle's output dir under `<module>/target/public/` can be left with a stale `.kbn-optimizer-cache` but no `*.js`. On restart the optimizer trusts the cache and skips rebuilding, so the browser fails to load that bundle. Fix: stop Kibana, delete the incomplete dirs, and restart. Find them with:
`for d in $(find . -path "*target/public" -type d); do [ -f "$d/.kbn-optimizer-cache" ] && [ -z "$(ls "$d"/*.js 2>/dev/null)" ] && echo "$d"; done`

Standard lint/test/type-check commands live in the sections above (`node scripts/jest`, `node scripts/eslint`, `node scripts/type_check --project ...`) — always scope them to a single package/config.
