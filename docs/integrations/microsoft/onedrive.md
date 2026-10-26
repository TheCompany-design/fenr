# Microsoft OneDrive Integration Specification

## 1. Overview & Agentic Capabilities

The OneDrive integration enables **Fenr** and the **Nabu** agent to:
* **Ingest Corporate Documents**: Index Word (`.docx`), Excel (`.xlsx`), PowerPoint (`.pptx`), and PDFs from personal or business OneDrive stores.
* **Delta Sync Engine**: Track incremental changes, additions, and deletions across entire folder hierarchies using Graph Delta queries.
* **Export Artifacts**: Save generated reports and exports directly into a designated OneDrive folder.
* **Large File Resumable Uploads**: Handle multi-gigabyte files via chunked upload sessions.

---

## 2. OAuth 2.0 & Scope Classification

* **Platform**: Microsoft Entra ID / Microsoft Graph.
* **Audit Requirement**: **No paid third-party security audit**. Free Microsoft Publisher Verification.
* **Scope**: `Files.ReadWrite` (Delegated) allows reading and writing all files the user has permission to access.
* **Narrow Alternative**: `Files.ReadWrite.AppFolder` restricts access solely to a dedicated app folder under `Apps/Fenr`.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ONEDRIVE GRAPH SCOPES                               │
│                                                                             │
│  [Narrow App Folder]                        [Standard User Files]           │
│  • Files.ReadWrite.AppFolder                • Files.ReadWrite               │
│    (Restricted to Apps/Fenr directory)        (Full access to user OneDrive)│
└─────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Scopes

| Scope | Type | Purpose | Consent Level |
| :--- | :--- | :--- | :--- |
| `Files.ReadWrite` | Delegated | Read, create, update, and delete user files in OneDrive. | User / Admin |
| `Files.ReadWrite.AppFolder` | Delegated | Read/write files inside dedicated `Apps/Fenr` subfolder. | User |

---

## 3. Core API Endpoints & Payload Contracts

All OneDrive endpoints target `https://graph.microsoft.com/v1.0/me/drive/`.

### A. List Files in Root or Subfolder
* **Endpoint**: `GET /root/children?$select=id,name,size,file,folder,lastModifiedDateTime`
* **Response**: Array of `driveItem` objects.

### B. Download File Content
* **Endpoint**: `GET /items/{driveItemId}/content`
* **Response**: Follows a `302 Found` redirect to a pre-authenticated Azure CDN blob download stream.

### C. Simple File Upload (< 4 MB)
* **Endpoint**: `PUT /items/{parentItemId}:/{filename}:/content`
* **Headers**: `Content-Type: application/octet-stream`
* **Body**: Raw file bytes.

### D. Resumable Upload Session (> 4 MB)
* **Endpoint**: `POST /items/{parentItemId}:/{filename}:/createUploadSession`
* **Payload**:
  ```json
  {
    "item": {
      "@microsoft.graph.conflictBehavior": "rename",
      "name": "Fenr-Knowledge-Dump.zip"
    }
  }
  ```
* **Response**: Returns `uploadUrl`. Nabu streams chunks with `Content-Range: bytes 0-3276799/20971520`.

### E. Delta Query (Incremental Sync)
* **Endpoint**: `GET /root/delta`
* **Mechanism**: Initial call returns all items + `@odata.deltaLink`. Future sync calls query the `deltaLink` to receive strictly newly added, modified, or deleted files without re-scanning.

---

## 4. Rate Limits & Quotas

* **Throttling**: Bound to Microsoft Graph per-user request limits (typically ~100 requests per minute).
* **Backoff**: Honor `Retry-After` response headers.

---

## 5. Nabu Tool Definition (Rust Agent Schema)

```rust
pub struct OneDriveUploadFileArgs {
    pub file_name: String,
    pub parent_folder_id: Option<String>,
    pub file_bytes: Vec<u8>,
}

pub struct OneDriveSyncDeltaArgs {
    pub delta_token: Option<String>,
}
```
