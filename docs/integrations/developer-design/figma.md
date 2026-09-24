# Figma Integration Specification

## 1. Overview & Agentic Capabilities

The Figma integration bridges design assets and engineering in **Fenr** and the **Nabu** agent:
* **Design Token Extraction**: Inspect Figma variables and styles to sync design system color tokens, typography, and spacing into Tailwind v4 CSS variables.
* **Component & Frame Inspection**: Query document node trees to extract layout properties, component hierarchies, and text content for code generation.
* **Render Frame Images**: Generate rendered PNG/SVG previews of specific design frames to embed inside Fenr project specifications.
* **Comment Synchronization**: Post comments directly on Figma canvas frames linked to Fenr review threads.

---

## 2. OAuth 2.0 & Scope Classification

* **Better-Auth Support**: Built-in `figma` provider.
* **Compliance Tier**: **Tier 1 (Permissive / Self-Serve)**.
* **Audit Requirement**: **None**. Figma provides self-serve OAuth 2.0 without security assessments or fees.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FIGMA OAUTH SCOPES                                 │
│                                                                             │
│  • files:read (Inspect document nodes, components, styles)                 │
│  • file_comments:write (Post comments on canvas frames)                     │
│  • file_variables:read (Read design tokens and variable collections)       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Scopes

| Scope | Type | Purpose |
| :--- | :--- | :--- |
| `files:read` | OAuth | Read file trees, canvas layers, and component metadata. |
| `file_comments:write` | OAuth | Post discussion comments anchored to canvas coordinates. |
| `file_variables:read` | OAuth | Access design tokens (colors, spacing, typography). |

---

## 3. Core API Endpoints & Payload Contracts

All endpoints target `https://api.figma.com/v1/`.

### A. Fetch Document Nodes
* **Endpoint**: `GET /files/{file_key}/nodes?ids={node_id}`
* **Response**: Returns full component JSON tree with layout modes, auto-layout constraints, and typography parameters.

### B. Render Frame Images
* **Endpoint**: `GET /images/{file_key}?ids={node_id}&format=png&scale=2`
* **Response**: Returns temporary AWS S3 URLs with rendered PNG images of the requested canvas nodes.

### C. Extract Design Variables (Tokens)
* **Endpoint**: `GET /files/{file_key}/variables/local`
* **Response**:
  ```json
  {
    "meta": {
      "variableCollections": { ... },
      "variables": {
        "VariableID:12:34": {
          "name": "primary-background",
          "resolvedType": "COLOR",
          "valuesByMode": {
            "mode_light": { "r": 1, "g": 1, "b": 1, "a": 1 },
            "mode_dark": { "r": 0.08, "g": 0.08, "b": 0.08, "a": 1 }
          }
        }
      }
    }
  }
  ```

### D. Post Comment to Canvas
* **Endpoint**: `POST /files/{file_key}/comments`
* **Payload**:
  ```json
  {
    "message": "Nabu: Implemented this card component in packages/ui.",
    "client_meta": { "node_id": "102:45" }
  }
  ```

---

## 4. Inbound Webhooks

Figma provides webhooks for file changes:

* **Endpoint**: `POST https://app.fenr.com/api/webhooks/figma`
* **Subscription**: `POST /webhooks` with events `FILE_UPDATE`, `FILE_COMMENT`.
* **Passcode Verification**: Verify `passcode` string included in Figma's JSON payload.

---

## 5. Rate Limits & Quotas

* **Standard Plan**: 100 requests per minute per token.
* **Header Inspection**: Figma returns `X-RateLimit-Remaining` and `X-RateLimit-Reset`.

---

## 6. Nabu Tool Definition (Rust Agent Schema)

```rust
pub struct FigmaGetFileNodesArgs {
    pub file_key: String,
    pub node_ids: Vec<String>,
}

pub struct FigmaRenderNodeImageArgs {
    pub file_key: String,
    pub node_id: String,
    pub format: Option<String>, // "png" or "svg"
}
```
