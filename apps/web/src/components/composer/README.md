# Composer

A composable prompt input for multi-provider LLM apps. Everything lives in this
one folder; copy it into another project and it works.

## Layout

```
catalog/       capability model, provider catalog, reconciliation, tokens
state/         the zustand store every surface reads from
primitives/    headless input shell, autocomplete, triggers, caret measuring
surfaces/      model picker, effort, tools, context rail, meter, feedback
data/          derived view models, `/` and `@` sources
hooks/         the seams between the store and a host app
index.ts       the only module a consumer should import
```

Dependencies point strictly downward. `catalog/` imports nothing from any other
folder and contains no React or DOM code, which is what makes the whole
capability model testable without rendering anything. `primitives/` knows
nothing about providers or models. Nothing imports a `surfaces/` module.

## Wiring it up

```tsx
import { ComposerMount, type ComposerBridge } from "@/composer";

const bridge: ComposerBridge = {
  // Read fresh every render; the meter depends on it.
  conversation: () => ({ systemPrompt, messages }),
  send: (payload) => startRequest(payload),
  onSettled: (status) => setStatus(status),
};

<ComposerMount bridge={bridge} />;
```

The composer never imports the query cache, a server function, or the router.
`ComposerMount` is the only seam, and `bridge` is the whole contract.

## The core idea

Everything a model can do is a **capability**, and almost every hard problem in
a multi-provider composer is really the same problem: _what is available right
now, and what happens to what the user already did when that changes._

```ts
capability = catalog ∩ entitlements ∩ connection → ResolvedCaps
```

- **catalog** — what the provider says exists
- **entitlements** — what _this key_ may use (plan tier, region, capacity)
- **connection** — whether there is a working credential at all

Three inputs, one pure function. See `catalog/resolve.ts`.

## Rules worth preserving

**Settings are adjusted; content is never discarded.** `reconcile` returns two
channels and the split is the design:

- `notices` — a setting was adjusted (effort clamped, tools pruned, search
  switched off). The user's intent is still satisfiable, so it is satisfied
  closely and reported once.
- `blockers` — content is at risk (images on a model without vision, a
  conversation over the context window). Send is disabled until they decide.

Silently dropping someone's attached file is the one unforgivable failure.
Silently dropping a tool toggle is not. If you add a capability, decide which
channel it belongs to.

**Provider and model are one selection.** `{ providerId, modelId }` is stored
together and never independently, because "this model" always implies its
provider. They are presented as a tab strip rather than two controls for the
same reason.

**Effort is stored canonically and encoded at the boundary.** The store holds
`"high"`. Each provider decides what that means — a string for OpenAI, a token
budget for Anthropic, nothing at all for a local model. See
`surfaces/effort-control.tsx`.

**One exit from the store.** Every mutation funnels through `apply()`, which
recomputes capabilities from the patched selection and then reconciles. No
action can bypass the invariants. Text-only edits take `applyLocal()`, which
skips the pipeline entirely — otherwise every keystroke would rebuild `caps`,
`blockers`, and `notices` as new references and wake every subscriber.

## Host-app seams

Three places deliberately reach outside, each behind an interface:

| Seam                    | Default                 | Swap with                        |
| ----------------------- | ----------------------- | -------------------------------- |
| `CredentialStore`       | `localStorage`          | `setCredentialStore(store)`      |
| `ComposerBridge`        | none — required         | the `bridge` prop                |
| `setReferenceableItems` | staged attachments only | whatever the app can `@`-mention |

## Known constraint

`computeCaps` memoizes on the _identity_ of its inputs (`runtime`, `selection`)
rather than comparing outputs. That is sound only because every mutation
affecting capabilities either replaces `runtime` or replaces `selection` — the
first genuinely equal result is reused instead of recomputed. If you add an
input to `resolveCapabilities`, make sure whatever changes it replaces one of
those two references, or the memo will serve a stale result.
