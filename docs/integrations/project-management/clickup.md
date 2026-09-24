# ClickUp Integration Specification

## 1. Overview & Agentic Capabilities

The ClickUp integration allows **Fenr** and the **Nabu** agent to interact with ClickUp workspaces:
* **Task & Subtask Orchestration**: Create, assign, prioritize, and close tasks within nested spaces, folders, and lists.
* **Custom Field Synchronization**: Read and populate custom fields (dropdowns, dates, numbers, checkboxes).
* **Time Tracking & Comments**: Post markdown task comments and log time entries.
* **Status Automation**: Shift task statuses across custom workflow pipelines.

---

## 2. OAuth 2.0 & Scope Classification

* **Better-Auth Support**: Implemented via the `genericOAuth` plugin.
  * **Auth URL**: `https://app.clickup.com/api`
  * **Token URL**: `https://api.clickup.com/api/v2/oauth/token`
* **Compliance Tier**: **Tier 1 (Permissive / Self-Serve)**.
* **Audit Requirement**: **None**. ClickUp does not enforce third-party security audits or review fees.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CLICKUP OAUTH SETUP                                │
│                                                                             │
│  • Generic OAuth 2.0 Authorization Code Flow                                │
│  • No granular scope fragmentation: Access token inherits full permissions   │
│    of the authorizing ClickUp user across authorized workspaces.            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Hierarchy & Core API Endpoints

ClickUp organizes work hierarchically: `Workspace (Team) -> Space -> Folder -> List -> Task`.

All endpoints target `https://api.clickup.com/api/v2/`.

### A. List User Workspaces & Teams
* **Endpoint**: `GET /team`
* **Response**: List of authorized workspaces and user IDs.

### B. Create Task in List
* **Endpoint**: `POST /list/{list_id}/task`
* **Payload**:
  ```json
  {
    "name": "Design system color token audit",
    "description": "Ensure Tailwind v4 CSS variables align with Figma tokens.",
    "status": "in progress",
    "priority": 2,
    "due_date": 1727788800000,
    "assignees": [1829381],
    "custom_fields": [
      {
        "id": "b3e042b9-uuid",
        "value": "High Impact"
      }
    ]
  }
  ```

### C. Query Tasks in Workspace
* **Endpoint**: `GET /team/{team_id}/task?statuses[]=in progress&assignees[]={user_id}`
* **Response**: Paginated list of tasks with tags, dates, and assignees.

---

## 4. Inbound Webhooks

ClickUp pushes task mutation events:

* **Endpoint**: `POST https://app.fenr.com/api/webhooks/clickup`
* **Subscription Setup**: `POST /team/{team_id}/webhook` specifying events (`taskCreated`, `taskUpdated`, `taskStatusUpdated`).
* **Signature Verification**: ClickUp sends `X-Signature`. Compute HMAC SHA-256 of the raw body against the webhook secret and verify.

---

## 5. Rate Limits & Quotas

* **Limit**: 100 requests per minute per token.
* **Handling**: Header `X-RateLimit-Remaining` indicates quota. Respect `Retry-After` on `429`.

---

## 6. Nabu Tool Definition (Rust Agent Schema)

```rust
pub struct ClickUpCreateTaskArgs {
    pub list_id: String,
    pub name: String,
    pub description_markdown: Option<String>,
    pub priority: Option<u8>, // 1 = Urgent, 2 = High, 3 = Normal, 4 = Low
    pub status: Option<String>,
}
```
