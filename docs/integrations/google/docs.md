# Google Docs Integration Specification

## 1. Overview & Agentic Capabilities

The Google Docs integration enables **Fenr** and the **Nabu** agent to:
* **Ingest Document Content**: Extract structural text, headings, lists, and tables for knowledge indexing.
* **Generate Documents**: Create formatted Google Docs from Fenr's Tiptap editor or agent outputs.
* **Batch Editing & Text Insertion**: Execute structural batch updates (insert text, style headings, append bullet lists).
* **Export & Bi-directional Sync**: Convert Fenr markdown / ProseMirror JSON trees into Google Docs native document structures.

---

## 2. OAuth 2.0 & Scope Classification

To avoid restricted scopes and external CASA audits:
* **Optimal Pattern**: Request `https://www.googleapis.com/auth/drive.file`.
* When a Google Doc is created by Fenr or selected by the user via the Google Picker, `drive.file` authorizes all read/write operations against the Google Docs API v1!
* **Dedicated Docs Scope**: `https://www.googleapis.com/auth/documents` is classified as **Sensitive** (not Restricted). It permits free review without a CASA audit, but `drive.file` remains preferred for narrower permission posture.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DOCS SCOPE HIERARCHY                               │
│                                                                             │
│  [Narrow & Safe - Recommended]              [Sensitive - Free Review]       │
│  • .../auth/drive.file                      • .../auth/documents            │
│    (Covers Docs created/picked by Fenr)       (Access all user docs)        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core API Endpoints & Payload Contracts

All Docs calls target `https://docs.googleapis.com/v1/documents/`.

### A. Create Blank Document
* **Endpoint**: `POST /documents`
* **Payload**:
  ```json
  {
    "title": "Fenr Project Brief: Q4 Strategic Initiatives"
  }
  ```
* **Response**: Returns `documentId`, `title`, and structural body tree.

### B. Read Document Structure
* **Endpoint**: `GET /documents/{documentId}`
* **Response Structure**:
  * Traverses `body.content[]` structural elements (`paragraph`, `table`, `sectionBreak`).
  * Extracts paragraph elements (`textRun.content`).

### C. Batch Updates (Insert Text & Styling)
* **Endpoint**: `POST /documents/{documentId}:batchUpdate`
* **Mechanism**: Atomic execution of requests against document character indices.
* **Payload**:
  ```json
  {
    "requests": [
      {
        "insertText": {
          "location": { "index": 1 },
          "text": "Executive Summary\nThis document details the architectural plan.\n"
        }
      },
      {
        "updateParagraphStyle": {
          "range": { "startIndex": 1, "endIndex": 18 },
          "paragraphStyle": { "namedStyleType": "HEADING_1" },
          "fields": "namedStyleType"
        }
      }
    ]
  }
  ```

---

## 4. ProseMirror / Tiptap to Google Docs Mapping

Because Fenr's editor is built on ProseMirror/Tiptap:

| Fenr / Tiptap Node | Google Docs Equivalent | Batch Update Request |
| :--- | :--- | :--- |
| `heading` (level 1-3) | `HEADING_1`, `HEADING_2`, `HEADING_3` | `updateParagraphStyle` |
| `bulletList` / `listItem` | Bullet Glyph Paragraph | `createParagraphBullets` |
| `codeBlock` | Monospace Courier Paragraph | `updateTextStyle` (`fontFamily: "Consolas"`) |
| `table` | Docs Structural Table | `insertTable` |

---

## 5. Rate Limits & Quotas

* **Read Requests**: 300 requests per minute per project; 60 requests per minute per user.
* **Write Requests**: 300 requests per minute per project; 60 requests per minute per user.
* **Batch Optimization**: Combine multiple inserts and formatting commands into a single `:batchUpdate` call to minimize roundtrips and conserve quota.

---

## 6. Nabu Tool Definition (Rust Agent Schema)

```rust
pub struct DocsCreateDocumentArgs {
    pub title: String,
    pub initial_content_markdown: String,
}

pub struct DocsAppendTextArgs {
    pub document_id: String,
    pub text_to_append: String,
    pub heading_style: Option<String>, // e.g. "HEADING_1", "NORMAL_TEXT"
}
```
