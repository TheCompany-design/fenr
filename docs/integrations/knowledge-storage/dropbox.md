# Dropbox Integration Specification

## 1. Overview & Agentic Capabilities

The Dropbox integration allows **Fenr** and the **Nabu** agent to:
* **Ingest Cloud Files**: Index PDFs, word documents, images, and audio files stored in Dropbox.
* **Continuous Delta Synchronization**: Maintain real-time sync with Dropbox folders using cursor-based delta pagination.
* **Export Artifacts & Backups**: Write generated reports and Fenr document archives directly into user Dropbox accounts.
* **Temporary Link Generation**: Generate time-limited secure download links for team members without changing file permissions.

---

## 2. OAuth 2.0 & Scope Classification

* **Better-Auth Support**: Built-in `dropbox` provider.
* **Compliance Tier**: **Tier 1 (Permissive / Self-Serve)**.
* **Audit Requirement**: **None**. Dropbox provides free app registration; no third-party CASA audit or lab assessment is required.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DROPBOX OAUTH SCOPES                               │
│                                                                             │
│  [Standard File Scopes - Free Self-Serve]                                   │
│  • files.metadata.read (Inspect folder trees and file metadata)             │
│  • files.content.read (Download file content for ingestion)                 │
│  • files.content.write (Upload exported documents)                          │
│                                                                             │
│  [Narrow App Folder Alternative]                                            │
│  • App Folder permission type: Restricts access strictly to /Apps/Fenr      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Scopes

| Scope | Type | Purpose |
| :--- | :--- | :--- |
| `files.metadata.read` | User | Read folder hierarchies and file change cursors. |
| `files.content.read` | User | Download files for text extraction and RAG indexing. |
| `files.content.write` | User | Upload generated documents and project exports. |

---

## 3. Core API Endpoints & Payload Contracts

Dropbox splits endpoints between RPC endpoints (`https://api.dropboxapi.com/2/`) and Content endpoints (`https://content.dropboxapi.com/2/`).

### A. List Folder Contents & Delta Cursor
* **Endpoint**: `POST https://api.dropboxapi.com/2/files/list_folder`
* **Payload**:
  ```json
  {
    "path": "/Projects/Q4 Roadmap",
    "recursive": false,
    "include_media_info": false
  }
  ```
* **Response**: Returns `entries[]` and `cursor`. Future changes are tracked by calling `POST /files/list_folder/continue` with the cursor.

### B. Download File Content
* **Endpoint**: `POST https://content.dropboxapi.com/2/files/download`
* **Headers**:
  * `Dropbox-API-Arg: {"path": "/Projects/Q4 Roadmap/Spec.pdf"}`
  * `Authorization: Bearer <access_token>`
* **Response**: Raw binary file stream.

### C. Upload Document (< 150 MB)
* **Endpoint**: `POST https://content.dropboxapi.com/2/files/upload`
* **Headers**:
  * `Dropbox-API-Arg: {"path": "/Fenr/Export.pdf", "mode": "overwrite", "autorename": true}`
  * `Content-Type: application/octet-stream`
* **Body**: Raw file bytes.

---

## 4. Inbound Webhooks

Dropbox sends notifications when files in watched folders change:

* **Endpoint**: `POST https://app.fenr.com/api/webhooks/dropbox`
* **Verification (GET)**: Dropbox sends `challenge` query parameter; Fenr returns the challenge as plain text.
* **Signature Verification (POST)**: Dropbox signs payloads with `X-Dropbox-Signature` (HMAC SHA-256 against App Secret).
* **Payload**: Contains list of `accounts` that had changes; Fenr triggers delta sync for those accounts.

---

## 5. Rate Limits & Quotas

* **Limit**: Standard per-user bandwidth and call limit (~1,200 calls/min).
* **Handling**: Exponential backoff on `429 Too Many Requests`.

---

## 6. Nabu Tool Definition (Rust Agent Schema)

```rust
pub struct DropboxUploadFileArgs {
    pub path: String,
    pub file_bytes: Vec<u8>,
    pub overwrite: bool,
}

pub struct DropboxDeltaSyncArgs {
    pub cursor: Option<String>,
}
```
