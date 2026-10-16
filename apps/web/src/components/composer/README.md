# Composer

A composable prompt input for multi-provider LLM apps. Everything lives in this
one folder; copy it into another project and it works.

## Layout

```
catalog/       capability model, provider catalog, reconciliation, tokens
state/         the zustand store every surface reads from
primitives/    headless input shell, autocomplete, triggers, caret measuring
surfaces/      add menu, model picker, effort, context rail, meter, feedback
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

**One box, two densities.** The composer is a single-row `pill` or a
multi-row `panel`, and the density is never *set* — it is a consequence of two
facts, both in `state/composer-density.ts`:

```ts
panel ⟺ the draft no longer fits one line ∨ a file is staged
```

Everything else follows from keeping that rule this small. The pill does not
move a single node: the same textarea, the same controls, the same action row —
it lays the row *over* the text instead of under it, which is why the caret,
the IME and the selection survive the morph untouched. And the fit test is taken
at pill geometry even while the box is a panel (`measurePillOverflow`), because
measured in whichever box it happens to be in, a draft on the wrap boundary
would expand, fit, collapse, and wrap again on every keystroke.

**The pill's ends are semicircles because the radius *clears* half the box.** A
corner is round exactly when the radius reaches half the box's height, and past
that the browser scales every corner by one uniform factor — so a radius *larger*
than half renders as precisely half and no more. That is what lets the pill be
rounded with an `lh` expression that overshoots on purpose, rather than exact
bookkeeping of the height. Two ways this goes wrong, both invisible without a
layout engine:

- `rounded-full` is `calc(infinity * 1px)`, and a transition *into* an infinite
  value never finishes in Chromium — the box sticks fully rounded forever. Both
  radii stay finite.
- a radius written as "half a line plus the shell's padding" comes out **short**,
  because `lh` is the shell's line box (1.5) and not the draft's
  (`leading-relaxed`). Two pixels short of a semicircle reads as a flat spot
  rather than as a deliberate shape.

The box's height is the draft's line plus the shell's padding, the border, and
whatever the editor wraps the draft in — only the first is a line. Which is also
why the textarea is `block`: as an inline-block it sits on a line box whose strut
adds leading *below* it, and once a scroll area wraps it that stray leading
becomes part of the box's height, leaving the draft sitting high in the pill.

**Chrome earns its place in the box.** The `+` and the send button are the
pill; the model picker and the context meter are not. In the pill they sit on
the row below it (`ComposerOutboard`), because a pill has one line to spend and
a model name is a fifth of it — and because a control that describes the draft
belongs beside it, not inside the thing being described. In the panel there is
a row to spare, so they move back inside. Exactly one instance of each is ever
mounted: two pickers would be two popovers and two subscriptions to one store.

**The textarea is never capped.** A capped textarea is a scroll container, and a
scroll container draws the browser's scrollbar — this repo has one scrollbar
language (`ScrollArea`) and no native ones. So `PromptInputEditor` caps the
*scroll area* around the draft (`PANEL_EDITOR_MAX_HEIGHT_PX`) and leaves the
textarea exactly as tall as its text. Two things follow, and both are easy to
get wrong:

- the browser now reveals the caret by scrolling an **ancestor**, so anything
  positioned from the textarea's box has to subtract the scroll between them
  (`measureCaret`'s `relativeTo`) and re-anchor when it moves (`onScroll`);
- "reset the editor's scroll" now means resetting the viewport, not the textarea
  (`editorScrollHost`) — writing `scrollTop = 0` on the textarea is a write to a
  number that is already zero.

The pill's one-line clamp is the exception, and it stays on the textarea: there
it is a *measurement*, not a cap.

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

**A model's levels are its own, and nothing ranks their names.** Effort is stored
as the level's *id* and encoded at the boundary — a string for OpenAI, a token
budget for Anthropic, nothing at all for a local model. But the vocabulary is
declared per model (`{ id, label }` pairs, in the provider's order) and that
declaration is the only ordering in the composer. There is deliberately no
function anywhere that compares two level *names*, because that operation cannot
be done correctly: OpenAI has no `max`, Anthropic has no `none`, and other
providers name levels in ways no shared table covers.

That is not a stylistic preference. Five copies of a fixed `none…max` ordering
lived in this folder, and each one produced a different bug — the control lit the
wrong level for any model not starting at the bottom of that table, the clamp
scored every unknown name as equally distant and so picked whichever was declared
first, and the budget ratio divided by five so a four-level model spent its top
level at four fifths of its own ceiling. See `catalog/effort.ts`, and
`catalog/providers.ts` for the one place a scale is declared.

A level's `id` and its `label` are separate because they are separate things: the
wire value is the provider's vocabulary and goes out verbatim, the label is for a
person. `xhigh`, `medium_effort` and `BALANCED` are all names a provider might
use, and a UI that prettifies the id renders the first two adequately and the
third as shouting caps.

The control is a bar rather than a row of buttons for the same reason. Segments
have to be given a width whether the model has two levels or six, so they narrow
as providers add levels and the chosen one gets harder to read; a bar places its
marks at the levels' own positions instead, so the control is the same shape
whatever the model offers and only the marks move. `levelPosition` is the knob's
position and `levelRatio` is what a level is *worth* — they are deliberately not
the same function, because the first level is worth `1/n` of a token budget but
belongs at the left end of the bar.

**Effort is never raised on the user's behalf.** Two paths can ask what to do
when the level they wanted is not on offer — the resolver, when a key's
entitlement narrows away a model's declared default, and `reconcile`, when the
user switches to a model with a different scale — and both take the *lowest* level
the model still has. They used to disagree, one falling back to the first level
and the other to the last, so the same key got a different answer depending on
which path asked; and the one that took the last quietly spent the user's tokens
at maximum because their plan could not reach the setting they chose. That is the
one adjustment that must never be made silently.

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
