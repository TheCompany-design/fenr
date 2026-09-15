# AGENTS.md — Fenr

Guidance for AI coding agents working in this repository.

## Stack

| Concern          | Library                                        |
| ---------------- | ---------------------------------------------- |
| Runtime          | **Bun only** (`bun`, `bun --bun` for Vite)     |
| Monorepo         | Turborepo + Bun workspaces                     |
| App framework    | TanStack Start (`apps/web`)                    |
| UI components    | shadcn in `packages/ui` (`@workspace/ui`)      |
| Styling          | Tailwind CSS v4                                |
| Icons            | hugeicons (`@hugeicons/react` + `@hugeicons/core-free-icons`) |
| Server data      | TanStack Query                                 |
| Global state     | Zustand                                        |
| Forms            | TanStack Form + Zod                            |
| Lint / format    | Biome (strictly — never ESLint/Prettier)       |
| Tests            | `bun test`                                     |

## Hard rules

### 1. Bun toolchain only

Never invoke `npm`, `npx`, `pnpm`, `yarn`, or the `node` binary directly.
Bun is the runtime, package manager, script runner and test runner.

```sh
bun install            # install (single root bun.lock)
bun run dev            # turbo → bun --bun vite dev
bun run build          # turbo → bun --bun vite build
turbo run start        # apps/web/server.ts — custom Bun.serve production server
bun run test           # bun test
bun run check          # biome check --write + typecheck
```

- All Vite invocations must be prefixed with `bun --bun` so Vite executes on
  Bun's runtime instead of Node.
- Do not add `engines.node`, `.npmrc`, or npm/pnpm config fields to any
  package.json.
- Production serving uses `apps/web/server.ts` — a Bun-native `Bun.serve`
  server that serves `dist/client` assets and falls back to TanStack Start's
  SSR handler (`dist/server/server.js`). Do not add Nitro or Node-based
  servers; plain `vite build` already emits the correct output.

### 2. Data fetching → TanStack Query

All network requests made outside of app runtime (route loaders, components,
effects) MUST go through TanStack Query:

- Use `queryClient.ensureQueryData(...)` in route loaders for SSR prefetching;
  the router's `setupRouterSsrQueryIntegration` handles dehydration/hydration.
- Use `useSuspenseQuery` / `useQuery` in components. Never fetch with bare
  `fetch()` inside effects, and never store server data in Zustand.
- Create QueryClients via `apps/web/src/lib/query-client.ts#createQueryClient`
  (one per request on the server).

### 3. Global state → Zustand

All global state — in-memory, sessionStorage, and localStorage — lives in
Zustand stores under `apps/web/src/lib/stores/`:

- Persisted state uses the `persist` middleware (`createJSONStorage`);
  choose `localStorage` vs `sessionStorage` in the storage factory.
- Never mirror query results into stores; never use React context as a
  global-state mechanism.

### 4. Forms → TanStack Form + Zod

Every form uses TanStack Form validated by a Zod schema (Standard Schema):

- Schemas live in `apps/web/src/lib/schemas/` and are passed directly as
  validators (e.g. `validators: { onChange: schema }`). No adapters needed.
- Shared schemas are the single source of truth; derive types with
  `z.infer`.

### 5. Components & styling

- Shared UI lives in `packages/ui` (`@workspace/ui`). Add components by
  running `bunx shadcn@latest add <component>` from `apps/web/` — the CLI
  routes shared components into `packages/ui` automatically. Import them as
  e.g. `import { Button } from "@workspace/ui/components/button"`.
- `components.json` keeps `"iconLibrary": "lucide"` purely for CLI
  compatibility. **After every `shadcn add`, replace any generated lucide
  imports with hugeicons** (`HugeiconsIcon` from `@hugeicons/react` +
  icon exports from `@hugeicons/core-free-icons`) and remove the lucide
  dependency if it reappears. `lucide-react` must not end up in any
  package.json or import statement.
- Styling is Tailwind v4 (CSS-first config in `packages/ui/src/styles/globals.css`).

### 6. Code quality

- Biome only. Run `bun run check` before finishing any change; keep it green.
- Generated files are excluded from lint/format: `routeTree.gen.ts`,
  `.output/`.
- Tests live next to sources as `*.test.ts(x)` and run with plain `bun test`.

### 7. Git Hygiene & Commit Practices

All changes must adhere to disciplined, atomic version control practices:

- **Atomic Commits**: Break work into small, cohesive, independently verifiable
  units. Never bundle unrelated changes (e.g. refactoring + feature + tooling)
  into a single monolithic commit.
- **Stage Deliberately**: Stage only the specific files and hunks that belong to
  the atom of work being committed (`git add <files>`). Never blindly run
  `git add .` or `git add -A` without inspecting git status and diffs.
- **Verification Before Staging/Committing**: Before every commit, ensure the
  code builds, typechecks, passes lint/formatting (`bun run check`), and passes
  applicable tests (`bun test`). Never commit broken code.
- **Conventional Commits**: Commit messages must follow the Conventional
  Commits standard (`<type>(<scope>): <short summary>`):
  - Types: `feat`, `fix`, `refactor`, `chore`, `test`, `docs`, `perf`, `style`.
  - Scopes: feature/package area (e.g. `stores`, `schemas`, `auth`, `organizations`, `routes`, `ui`, `tooling`).
  - Imperative mood, lowercase, concise description, no trailing period.
  - When helpful, include a body explaining the rationale and non-obvious design choices.
- **Clean Working Tree**: Temporary scratch files, build artifacts, and
  incidental changes must never be committed.

### 8. Skills

Load and follow these skills when the task matches them:

- `/vercel-react-best-practices` — React/Next.js-style performance patterns for React code
- `/logging-best-practices` — logging (wide events / canonical log lines)
- `/animation-vocabulary` — naming motion effects when discussing animations
- `/apple-design` — gesture-driven UI, springs, materials, motion feel
- `/fixing-motion-performance` — jank, layout thrashing, compositor properties
- `/improve-animations` — animation audits and improvement plans
- `/transitions-dev` — production-ready CSS transitions
- `/shadcn` — anything involving shadcn components or registries
- `/ui-ux-pro-max` — UI/UX design intelligence (styles, palettes, fonts, UX rules)
- `/emil-design-eng` — component design polish and micro-interaction details

## Styling convention

- All design tokens and component CSS live in `packages/ui/src/styles/globals.css`
  (`@layer base`, `@layer components`, `@layer utilities`).
- Components must **not** use hard-coded Tailwind values (e.g. `bg-white`,
  `text-gray-900`). Instead use CSS variable tokens mapped through
  `@theme inline` (e.g. `bg-background`, `text-foreground`, `border-border`).
- This keeps theming (light/dark mode) centralized and makes refactoring safe.
- **Custom ScrollArea**: avoid native browser scrollbars. All scrollable
  containers (chat feeds, thread lists, dropdown menus, side panels) MUST use
  `@workspace/ui/components/scroll-area` (Radix/shadcn `<ScrollArea />`).

## Working with shadcn/ui Blocks

Throughout the lifetime of this project we will periodically install `shadcn`
blocks into the repository. Do **not** treat generated block code as
production-ready architecture. Generated code is a reference implementation —
consider it raw material.

Rebuild it from scratch using the project's architectural conventions:

- Organize files and folders by feature/domain rather than mirroring the
  generated output.
- Extract reusable UI into shared components where appropriate.
- Create shell/layout components when a component is primarily responsible
  for composition.
- Separate presentation from business logic.
- Move state management, effects, and event handling into custom hooks whenever
  they improve clarity or reusability.
- Extract utility functions into appropriate utility modules.
- Remove duplication aggressively and improve naming.
- Ensure components have clear, single responsibilities.
- Follow existing project conventions before introducing new patterns.
- **Reusability**: extract UI elements (buttons, cards, empty states, dialogs,
  drawers, etc.) if they have a reasonable chance of being reused.
- **Maintainability**: favor small focused components, predictable file
  structures, minimal prop drilling, composition over configuration, and
  readability. Avoid "God components".
- **Functional equivalence**: rebuilt implementations must preserve the
  original functionality and user experience unless there is a clear
  improvement (e.g. accessibility, performance, cleaner state, types).

## Layout

```
apps/web        TanStack Start app (Bun + custom Bun.serve prod server)
packages/ui     @workspace/ui — shadcn components, Tailwind v4 styles
biome.json      root lint/format config
turbo.json      build/dev/typecheck/test tasks
```

---

# Core Workflow (governs ALL work in this repo)

Every piece of work MUST be broken into **small, independently verifiable blocks of work**.

Each block must:

1. Have a clear and narrow scope.
2. Have a defined outcome that can be verified.
3. Be implemented by a **primary implementer agent**.
4. Be reviewed by a **team of adversarial review agents**.
5. Pass all applicable review dimensions before it can be considered complete.
6. Only be staged and committed **after all reviewers are satisfied**.

Do not allow a large feature to become one enormous implementation/review cycle. Decompose it into the smallest meaningful units that can be independently implemented, tested, reviewed, and committed.

This repository ships project-scoped agents for exactly this loop (discovered automatically by pi-subagents from `.agents/agents/`):

- `implementer` — primary implementer (`.agents/agents/implementer.md`)
- `correctness-reviewer` — defensive programming, error paths, edge cases, state, data integrity
- `concurrency-reviewer` — races, cancellation, resources, idempotency, contracts
- `quality-reviewer` — security, validation boundaries, tests, maintainability, UX error messaging, observability

Shared rubric read by all reviewers: `.agents/agents/review-framework.md`.

**Orchestration requirement:** these are project-scope agents resolved from the working directory. Any session or subagent run that orchestrates this workflow MUST execute with cwd = this repository root (`bizos/`). Launched from a parent workspace directory, the agents will not be discovered.

### Primary Implementer

The primary implementer owns the block of work. They should:

* Understand the existing architecture before modifying it.
* Implement only the requested scope.
* Follow existing project conventions.
* Prefer simple, explicit solutions over unnecessary abstraction.
* Add or update tests where appropriate.
* Handle success and failure paths.
* Ensure user-facing failures produce useful error messages (via `<Sonner />`).
* Ensure operational failures are logged appropriately (via Pino).
* Verify the implementation locally before requesting review (`bun run check`, `bun test`, dev-server exercise).

The implementer must **not declare the block complete simply because the happy path works**, and must never stage/commit before review passes.

### Adversarial Review Team

After implementation, assign multiple review agents to independently inspect the work.

Reviewers behave as adversaries attempting to find ways the implementation can fail. They do not perform stylistic review or rubber-stamp. Each reviewer inspects the code against the full review framework (`.agents/agents/review-framework.md`) through their assigned lens and reports:

* The specific issue.
* The concrete scenario in which it manifests.
* Why the current implementation is incorrect, unsafe, fragile, or incomplete.
* The appropriate fix.
* Whether the issue is blocking or non-blocking.

Reviewers must distinguish **actual problems from hypothetical concerns**. Do not manufacture findings merely to produce a review. Findings carry severity (P0 = blocks merge, P1 = fix before release, P2 = note) and end with `Merge verdict: BLOCK`, `Merge verdict: OK`, or `Merge verdict: OK with notes`.

If any reviewer discovers a blocking issue, the block returns to the implementer. The fix must go through review again. Work is not complete until the adversarial review team agrees all applicable dimensions are satisfied.

---

# Mandatory Review Dimensions

Every reviewer must consider the following dimensions (full detail in `.agents/agents/review-framework.md`).

## 1. Defensive Programming
Look for assumptions the code makes about inputs, state, dependencies, and external systems. Verify that malformed, missing, unexpected, stale, or invalid values cannot cause crashes, panics, corrupted state, or undefined behavior. Focus areas: optional/null values, type conversions, empty collections, array/index access, parsing, user input, external API responses, filesystem/network operations, database results, configuration, environment variables. Do not add defensive complexity where the type system or architecture already provides the guarantee.

## 2. Graceful Error Propagation
Trace errors from origin to final consumer. Errors must never be silently swallowed; preserve the underlying cause where useful; gain meaningful contextual information as they cross boundaries; reach the appropriate layer; be converted into appropriate user-facing feedback. Do not dump raw internal errors to users.

## 3. User-Facing Error Messaging
User-facing errors MUST be delivered through `<Sonner />`. Communicate what happened, why (when useful), what to do next (when actionable). Avoid vague messages. Do not expose stack traces, internals, secrets, or raw infrastructure errors. Every user-facing failure path should deliver an appropriate `<Sonner />` notification where applicable.

## 4. Logging & Observability
Application logging MUST use **Pino** following `/logging-best-practices`. Review log levels, structured context, correlation/request identifiers, error context, operationally useful metadata, avoidance of sensitive data, avoidance of noisy/duplicate logging across layers, and preservation of original error information. No ad-hoc `console.log`/`console.error` where Pino infrastructure should be used.

## 5. Exhaustive Case Handling
Identify every enum variant, union variant, state, event, branch, input shape, error condition, and lifecycle state; verify each is intentionally handled. Watch for default branches hiding missing cases, "impossible" states, newly introduced variants, partial matching, state machines, async lifecycle states. Fail explicitly and safely rather than silently doing the wrong thing.

## 6. Edge Cases & Boundary Conditions
Actively attempt to break the implementation with empty values, zero values, max/min values, missing values, duplicates, extremely large inputs, first/last items, repeated operations, stale data, unexpected ordering, missing dependencies, expired resources.

## 7. Failure-Path Correctness
Trace what happens when network requests fail, DB operations fail, parsing fails, serialization fails, dependencies return malformed data, files are inaccessible, permission checks fail, timeouts occur, async operations cancel, downstream services become unavailable. Failures must leave the application in a valid state.

## 8. State Consistency & Invariants
Identify important invariants and verify every mutation preserves them. Watch for partially applied operations, stale state, inconsistent caches, orphaned records, duplicate side effects, updates applied before success, and post-failure inconsistency.

## 9. Resource & Lifecycle Management
Verify resources are correctly acquired and released: connections, file handles, locks, timers, event listeners, subscriptions, async tasks, temporary files. Pay particular attention to cleanup during failures and cancellation.

## 10. Concurrency & Race Conditions
Look for shared mutable state, check-then-act patterns, concurrent mutations, race conditions, deadlocks, lock ordering, duplicate work, async ordering assumptions, cancellation races, stale writes. Do not assume async operations complete in initiation order.

## 11. Validation & Trust Boundaries
Identify every trust boundary (user input, HTTP requests, DB records, files, env vars, third-party APIs, IPC, external integrations, plugin systems) and verify data is validated at the appropriate boundary. Do not rely solely on callers to provide valid data.

## 12. Security
Review for authorization bypasses, missing permission checks, injection vulnerabilities, unsafe deserialization, path traversal, secret leakage, sensitive data exposure, insecure defaults, confused-deputy problems, and trust-boundary violations.

## 13. Idempotency & Duplicate Execution
For side-effecting operations, verify behavior when executed twice, retried, partially succeeded, timed out after succeeding, or triggered concurrently. Particular attention: payments, messages, jobs, webhooks, DB writes, external APIs.

## 14. Cancellation & Timeout Behavior
For async/long-running operations, verify behavior on caller cancel, navigation away, connection close, timeout, and unresponsive dependencies. Cancellation should propagate appropriately; abandoned work should not continue unnecessarily.

## 15. Data Integrity & Persistence
Review DB writes, transactions, serialization, migrations, caching, persistence boundaries for data loss, partial commits, stale overwrites, corrupted persisted state, incompatible serialized data.

## 16. API & Abstraction Contracts
Verify abstractions enforce their intended contracts: names implying stronger guarantees than provided, ambiguous return semantics, inconsistent error behavior, leaked implementation details, hidden side effects, undocumented caller assumptions.

## 17. Observability & Diagnosability
A production failure should be diagnosable from logs without local reproduction. Important failures need structured context: what failed, where, relevant identifiers, underlying cause, relevant state. Never log secrets or sensitive data for convenience.

## 18. Testing Coverage
Review tests for meaningful behavioral coverage, not quantity. Where applicable: happy paths, invalid inputs, boundary conditions, every meaningful variant/state, dependency failures, retries, cancellation, timeouts, concurrency, persistence failures, error propagation, user-facing error behavior. Specifically look for **untested failure modes**.

## 19. Backward & Forward Compatibility
Consider breaks to existing persisted data, API consumers, DB schemas, serialized formats, configuration, plugins, clients, older versions. Pay attention to renamed fields, enum changes, migrations, changed defaults.

## 20. Maintainability & Future Failure Modes
Find code that works today but is fragile tomorrow: duplicated logic, hidden coupling, magic assumptions, overly clever abstractions, excessive complexity, implicit behavior, silent-break extension points. Prefer straightforward code whose correctness is obvious.
