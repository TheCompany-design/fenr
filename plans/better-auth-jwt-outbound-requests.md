# Better Auth JWT outbound-request architecture

## Context

- Fenr uses Better Auth sessions today (`apps/web/src/lib/auth.ts`, `apps/web/src/lib/auth-client.ts`) and routes server data through TanStack Query query options/server functions.
- The installed Better Auth version is 1.7.1. Its JWT server plugin exposes `/token`, `/jwks` (configurable), signing/verification support, issuer/audience/expiry options, and a persistent `jwks` key store; its client plugin exposes JWKS access but not a direct token helper in the installed type surface. Token minting for server-to-server calls should therefore use the server API with the current request headers/session, not expose signing keys or session tokens to browser code.
- Outbound HTTP is currently fragmented: the dashboard has a direct `fetch()` query function, while Nabu has a server-only HTTP client (`apps/web/src/features/nabu/client.ts`) used by query-backed server functions.
- The goal is to add Better Auth JWT support, make authenticated outbound requests carry a token, make request destinations discoverable, and make future request definitions type-enforced so authentication cannot be omitted accidentally.
- Better Auth documentation research: the JWT plugin issues/verifies JWTs for external services (token/JWKS endpoints and client `authClient.token()`), but is not a session replacement. Better Auth recommends the Bearer plugin when the receiving API should authenticate an existing Better Auth session token. The selected design is JWT plugin tokens for private downstream services; Nabu will verify them against Fenr's JWKS endpoint. Public third-party requests remain explicitly unauthenticated. The JWT plugin is not a generic fetch interceptor, so the shared server transport must acquire/inject the token at the private-service boundary.

## Approach

1. Configure Better Auth's server JWT plugin with explicit issuer/audience/expiry/key-storage decisions, and document Nabu's JWKS verification contract. Bearer support is not the selected outbound token model unless a separate auth endpoint requires it.
2. Establish one typed outbound HTTP/request registry abstraction. Every request definition will declare a destination/service, method/path, response schema, and an authenticated request contract whose headers are supplied by the shared client. The registry exposes service/path names in one searchable location, while feature modules retain domain-specific schemas and Query keys. The public API should make an unauthenticated request impossible or require an explicit, reviewed public-request type for auth endpoints/third-party public data.
3. Route all server data access through this client and TanStack Query query/mutation options; remove direct feature-level `fetch()` calls. The private transport obtains a short-lived JWT from Better Auth's server `getToken` API using the current request headers/session, then sets `Authorization: Bearer <jwt>` itself; callers cannot replace that header. Keep server-only token acquisition and secrets out of browser code, and preserve request timeout/cancellation/error parsing, schema validation, Pino diagnostics, and user-facing Sonner handling at the existing layers.
4. Add tests that prove token/header injection, destination mapping, public/authenticated distinctions, malformed responses, timeout/cancellation, and Query integration. Use the project’s implementer plus correctness/concurrency/quality adversarial review loop before any commit.

## Files to modify

Initial likely scope (to confirm during exploration):

- `apps/web/src/lib/auth.ts` — server JWT/Bearer plugin configuration and plugin ordering.
- `apps/web/src/lib/auth-client.ts` — likely unchanged for the server-to-server flow; add `jwtClient()` only if a documented browser-side JWKS/token use case emerges. The installed JWT client plugin exposes JWKS access, while private outbound token minting belongs server-side.
- `apps/web/src/features/nabu/client.ts` — migrate to shared typed authenticated transport or adapt as the service adapter.
- `apps/web/src/features/nabu/server.ts`, `apps/web/src/features/nabu/queries.ts` — preserve Query-only access and typed request definitions.
- `apps/web/src/features/dashboard/queries.ts` — replace direct `fetch()` with the shared transport/query function, explicitly classifying JSONPlaceholder as public/demo data and ensuring it never receives the private JWT.
- New `apps/web/src/lib/http/` (or existing suitable location) — service registry, authenticated/public request clients, token-provider seam, request types, and tests.
- Relevant `*.test.ts` files and possibly environment/schema files for token/API configuration.
- `apps/web/package.json` / lockfile only if the installed Better Auth version lacks the needed plugin exports.
- `packages/database/src/schema/auth/` and a new Drizzle migration/snapshot — add the Better Auth JWT `jwks` persistence schema using the project’s normal migration workflow; do not hand-wave key persistence or store private keys in environment variables unless Better Auth’s supported adapter path requires it.

## Reuse

- `apps/web/src/features/nabu/client.ts`: existing timeout, request ID, response/error parsing, status handling, and Zod response-validation pattern.
- `apps/web/src/features/nabu/server.ts` and `apps/web/src/features/nabu/queries.ts`: existing server-function + TanStack Query boundary.
- `apps/web/src/lib/auth.ts`: Better Auth server configuration and server-only environment boundary.
- `apps/web/src/lib/auth-client.ts`: safe client auth surface.
- `apps/web/src/lib/env.ts` and `apps/web/src/lib/logger.ts`: validated configuration and Pino module logging.
- Existing feature schemas under `apps/web/src/lib/schemas/`: response/input validation rather than trusting remote JSON.

## Steps

- [x] Resolve token semantics and receiving-service contract: use JWT plugin tokens for private services only; Nabu verifies Fenr-signed JWTs through JWKS; browser-originated public requests are not in scope.
- [x] Confirm the initial Nabu JWT contract: issuer is `BETTER_AUTH_URL`, audience is stable `nabu`, and the verifier is treated as a repo-local/integration concern to document and configure where available. Nabu should consume Fenr's JWKS endpoint, use the default supported asymmetric algorithm unless its verifier requires a specific compatible choice, and refresh keys for rotation.
- [x] Inventory every outbound HTTP request (including auth client calls and server functions) and classify each as authenticated service, public third-party, or same-origin auth/control-plane traffic.
- [x] Design the typed request registry/transport so authenticated request definitions cannot omit token-bearing headers, while public requests require an explicit type/constructor. Include a compile-time fixture showing that missing auth policy is rejected and caller headers cannot override `Authorization`.
- [x] Configure Better Auth's server JWT plugin with `issuer: BETTER_AUTH_URL`, `audience: "nabu"`, a bounded expiry, default asymmetric signing, JWKS endpoint, rotation/storage migration, and plugin ordering compatible with `tanstackStartCookies()`. Document `/token` and `/jwks` plus Nabu verification and rotation behavior; do not add Bearer unless another boundary needs session-token authentication.
- [x] Implement the shared transport with token injection, header merging that cannot overwrite the auth header, timeout/AbortSignal composition, request IDs, structured Pino logging, safe error mapping, and response-schema validation. Keep token values out of logs and avoid leaking downstream raw errors to UI consumers.
- [x] Migrate Nabu and dashboard outbound calls to the transport; keep all reads/writes exposed through TanStack Query options/server functions.
- [x] Add focused unit/integration tests for header presence, auth-header protection, request registry discoverability, token absence/expiry behavior, public opt-in, failure paths, and Query functions.
- [x] Run `bun run check`, `bun test`, and a dev-server/manual request exercise; have the required adversarial reviewers inspect the block and fix findings before staging/committing.

## Verification

- Static inventory/search shows no feature-level raw `fetch()` remains outside the centralized transport, except intentionally documented auth plumbing or explicitly public transport internals. Current inventory is two raw application fetch sites: Nabu (`features/nabu/client.ts`) and public dashboard demo data (`features/dashboard/queries.ts`); Better Auth handler/client traffic is a separate auth transport and should not be wrapped.
- Typecheck fails for a newly declared authenticated request that omits the required auth contract/header policy; public requests are visibly explicit.
- Tests assert every authenticated outbound request sends the expected `Authorization` scheme/token and cannot be overridden by caller headers.
- Tests cover token acquisition failure, expired/absent token, timeout, cancellation, non-2xx/malformed JSON, schema mismatch, and safe logging/error behavior.
- `bun run check` and `bun test` pass; manual/dev verification confirms the JWT/JWKS flow against Nabu, including issuer/audience/signature validation and key rotation behavior, without exposing secrets to the client.
