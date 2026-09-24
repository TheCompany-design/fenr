# Notion Integration Specification

## 1. Overview & Agentic Capabilities

The Notion integration allows **Fenr** and the **Nabu** agent to interact with Notion workspaces:
* **Knowledge Ingestion (RAG)**: Traverse nested page blocks to extract markdown text, tables, and callouts into Fenr's vector knowledge store.
* **Database Queries & Filtering**: Filter and sort structured databases (e.g. Project Roadmaps, Customer CRM, Sprint Trackers).
* **Page Creation & Updates**: Automatically generate formatted Notion pages with headings, code snippets, and callouts from agent tasks.
* **Database Record Upsert**: Insert new entries into Notion databases with typed properties (select, date, relation, rich_text).

---

## 2. OAuth 2.0 & Workspace Token Architecture

* **Better-Auth Support**: Built-in `notion` provider.
* **Token Model**: Notion OAuth returns a **workspace-level bot token** (`secret_...`) authorized for specific pages the user selects during OAuth consent.
* **Compliance Tier**: **Tier 1 / Tier 2 (Free Notion Review)**.
* **Audit Requirement**: **None**. Internal integrations require zero review; public marketplace integrations undergo a free functional review. No third-party CASA audit.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          NOTION AUTH MODEL                                  │
│                                                                             │
│  • User selects specific pages or parent databases during consent.          │
│  • Returns `bot_id`, `workspace_id`, `workspace_name`, and `access_token`.   │
│  • Notion API Version Header required: `Notion-Version: 2022-06-28`.        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core API Endpoints & Block Models

All endpoints target `https://api.notion.com/v1/` with header `Notion-Version: 2022-06-28`.

### A. Query Database Records
* **Endpoint**: `POST /databases/{database_id}/query`
* **Payload**:
  ```json
  {
    "filter": {
      "property": "Status",
      "select": { "equals": "In Progress" }
    },
    "page_size": 25
  }
  ```
* **Response**: List of page records with typed property values.

### B. Read Page Block Tree (Recursive)
* **Endpoint**: `GET /blocks/{block_id}/children?page_size=100`
* **Response Traversal**: Parse block objects (`paragraph`, `heading_1`, `heading_2`, `bulleted_list_item`, `code`, `callout`).

### C. Create Page in Database
* **Endpoint**: `POST /pages`
* **Payload**:
  ```json
  {
    "parent": { "database_id": "d981a2f9-uuid" },
    "properties": {
      "Name": {
        "title": [{ "text": { "content": "Fenr Architectural Decision Record #12" } }]
      },
      "Status": {
        "select": { "name": "Approved" }
      }
    },
    "children": [
      {
        "object": "block",
        "type": "heading_2",
        "heading_2": {
          "rich_text": [{ "type": "text", "text": { "content": "Context & Rationale" } }]
        }
      },
      {
        "object": "block",
        "type": "paragraph",
        "paragraph": {
          "rich_text": [{ "type": "text", "text": { "content": "Standardized on Bun runtime and Biome tooling." } }]
        }
      }
    ]
  }
  ```

---

## 4. Rate Limits & Quotas

* **Limit**: Average of 3 requests per second per integration token.
* **Throttling Response**: Returns `429 Too Many Requests` with `Retry-After`. Implement client-side queueing in Nabu.

---

## 5. Nabu Tool Definition (Rust Agent Schema)

```rust
pub struct NotionCreatePageArgs {
    pub parent_database_id: String,
    pub title: String,
    pub properties_json: serde_json::Value,
    pub body_markdown: String,
}

pub struct NotionQueryDatabaseArgs {
    pub database_id: String,
    pub filter_property: Option<String>,
    pub filter_value: Option<String>,
}
```
