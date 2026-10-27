# Generative UI in Nabu

Fenr renders model-authored OpenUI Lang in assistant messages while retaining its own
chat shell, composer, thread storage, auth, and agent-stream transport. OpenUI Lang is a
constrained declarative format; it is not JSX, HTML, or arbitrary JavaScript. The renderer
only runs programs from an explicit `openui-lang` fence (or a bare `root = …` program).
Other assistant responses continue to render as plain text.

## Runtime flow

1. Nabu adds the generated OpenUI component contract to its existing system prompt.
2. The agent emits normal prose or an optional fenced OpenUI Lang program.
3. Fenr streams assistant content as before. The chat turn detects the explicit format
   and passes the accumulated program to OpenUI's streaming React renderer.
4. Built-in `$`-state controls stay in the browser. `@ToAssistant` submits a new user
   turn through Fenr's existing stream hook and includes bounded submitted form values.
   `@OpenUrl` accepts only HTTP(S) destinations and opens them with `noopener,noreferrer`.
5. OpenUI parser/runtime errors are logged without including generated content and produce
   a user-facing toast after generation finishes.

The generated prompt is maintained from the same version of OpenUI's chat library used by
Fenr. When updating the library, run `bun run --cwd apps/web genui:prompt`; this writes the
prompt consumed by the Nabu Rust agent at
`thebookofnabu/crates/nabu-agent/prompts/openui-system-prompt.txt`. Both repositories must
ship together when the language contract changes.

## Component-library audit and sourcing guide

The following sites were inspected for their component organization and agent-specific
patterns. These catalogs are primarily source registries/examples (many are shadcn-style
copy-in components), not dependencies that should all be loaded into the application.

| Source | Strong agent-oriented components | Best use in Fenr | Decision |
|---|---|---|---|
| [shadcn/ui](https://ui.shadcn.com/) | Accessible primitives and composable blocks | Shared product primitives and form/layout foundations | Required; Fenr already owns shadcn in `packages/ui`. Keep app styling on its semantic tokens. |
| [Beautiful UI](https://www.beautifului.dev/) | Loading states, thinking traces, streaming text, approval cards, tool chips, task rows, context cards | Compact, legible agent activity and approvals | Use as a pattern/source for agent-surface primitives; don't replace the chat shell. |
| [Prompt Kit](https://www.prompt-kit.com/) | Reasoning, chain of thought, tools, sources, steps, message, loader, prompt input | Composer/chat primitives where Fenr lacks equivalent behavior | Prefer its focused agent components; Fenr already has its own composer and tool status. |
| [Nessa Labs](https://www.nessalabs.ai/ui/components) | Tool approval, task/activity lists, agent details, generating surface, message scroller, questionnaire, workflow canvas | Structured agent lifecycle, questionnaire, and workflow surfaces | Strong source for behavioral/compound agent surfaces; adopt narrowly. |
| [assistant-ui](https://www.assistant-ui.com/components) | Streaming chat, tool calls, reasoning, attachments, actions, data visualization and generative UI | Backend-agnostic thread/chat patterns and tool activity | Valuable integration/reference library; avoid replacing Fenr's existing thread/stream architecture wholesale. |
| [Kobra](https://kobra.systems/components) | Reasoning steps, trace waterfall, approvals, plans/questions, streaming text, document agent, diff/table/chart | Specialized agent status and output components | Use for targeted, visually differentiated agent surfaces; prefer existing shadcn primitives where generic. |

The repeated Beautiful UI URL in the original request was treated as one source. The current
GenUI implementation uses OpenUI's chat component library for its declarative catalog and
renderer, rather than importing multiple overlapping chat frameworks. shadcn remains the
application foundation; the other catalogs are source material for future focused additions.

## Current scope and guardrails

- OpenUI Lang and OpenUI React UI are pinned in `apps/web/package.json`; the shared style
  sheet imports the layered OpenUI CSS below consumer utilities and above Tailwind base.
- The renderer uses the existing chat turns and handles progressive partial programs.
  Plain messages and unrelated fenced code are not reinterpreted as UI.
- Host actions are allow-listed. No AppBlock, arbitrary source evaluation, or external
  component loading is enabled.
- Query/Mutation remote tool providers and persisted OpenUI form state are not wired yet;
  generated interfaces must not claim live account data unless obtained through a trusted
  agent/tool path. Avoid using generated UI as an authorization boundary.
- The OpenUI library includes more visual primitives than this application has enabled
  server-side data tools. Future Query/Mutation work must add authenticated, tenant-scoped
  endpoints before listing tool capabilities in the prompt.
