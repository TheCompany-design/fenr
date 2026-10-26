# Jira Integration Specification (Atlassian Cloud)

## 1. Overview & Agentic Capabilities

The Jira integration enables **Fenr** and the **Nabu** agent to interact with Atlassian Jira Cloud:
* **Enterprise Issue Tracking**: Create bugs, tasks, and stories with custom fields, priorities, and components.
* **JQL (Jira Query Language) Search**: Perform queries to retrieve issues across complex enterprise boards.
* **Transition Workflows**: Move tickets through complex workflow transition schemas (e.g. `To Do` $\rightarrow$ `Code Review` $\rightarrow$ `QA` $\rightarrow$ `Closed`).
* **Worklog & Comment Logging**: Record time spent and post automated agent summaries.

---

## 2. OAuth 2.0 & Scope Classification (Atlassian 3LO)

* **Better-Auth Support**: Built-in `atlassian` provider.
* **Compliance Tier**: **Tier 1 / Tier 2 (Free Atlassian Review)**.
* **Audit Requirement**: **None**. Atlassian provides self-serve OAuth 2.0 (3LO) apps. Marketplace listing requires a free security questionnaire, but no paid CASA lab audit.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ATLASSIAN 3LO SCOPES                               │
│                                                                             │
│  [Standard OAuth 2.0 - Free Verification]                                   │
│  • read:jira-work (Read issues, projects, worklogs)                         │
│  • write:jira-work (Create/edit issues, comments, transitions)              │
│  • read:jira-user (Read user profiles and accountIds)                       │
│  • offline_access (Refresh token persistence)                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### The Cloud ID Resolution Requirement
Unlike other APIs with fixed endpoints, Atlassian 3LO routes through site-specific Cloud IDs:
1. Exchange OAuth code for Bearer token.
2. Query `GET https://api.atlassian.com/oauth/token/accessible-resources`.
3. Extract `id` (Cloud ID) and `url` (e.g. `your-company.atlassian.net`).
4. Execute all Jira REST calls against: `https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/`.

---

## 3. Core API Endpoints & Payload Contracts

All endpoints target `https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/`.

### A. Search Issues via JQL
* **Endpoint**: `POST /search`
* **Payload**:
  ```json
  {
    "jql": "project = ENG AND status in ('In Progress', 'Open') ORDER BY priority DESC",
    "maxResults": 25,
    "fields": ["summary", "status", "assignee", "priority", "created"]
  }
  ```

### B. Create an Issue (Atlassian Document Format ADF)
* **Endpoint**: `POST /issue`
* **Payload**:
  ```json
  {
    "fields": {
      "project": { "key": "ENG" },
      "summary": "Fix memory leak in websocket reconnection loop",
      "issuetype": { "name": "Bug" },
      "priority": { "name": "High" },
      "description": {
        "version": 1,
        "type": "doc",
        "content": [
          {
            "type": "paragraph",
            "content": [
              {
                "type": "text",
                "text": "Identified recurring connection drop in long-running sessions."
              }
            ]
          }
        ]
      }
    }
  }
  ```

### C. Transition Issue State
1. Fetch available transitions: `GET /issue/{issueIdOrKey}/transitions`.
2. Execute transition:
   * **Endpoint**: `POST /issue/{issueIdOrKey}/transitions`
   * **Payload**: `{ "transition": { "id": "31" } }`.

---

## 4. Rate Limits & Quotas

* **Cost-Based Throttling**: Atlassian rates requests by computational complexity.
* **Standard Threshold**: ~50–100 requests per minute per user.
* **Response Header**: Check `Retry-After` on `429 Too Many Requests`.

---

## 5. Nabu Tool Definition (Rust Agent Schema)

```rust
pub struct JiraCreateIssueArgs {
    pub project_key: String,
    pub issue_type: String, // "Bug", "Task", "Story"
    pub summary: String,
    pub description_adf_json: serde_json::Value,
    pub priority: Option<String>,
}

pub struct JiraSearchJqlArgs {
    pub jql: String,
    pub max_results: Option<u32>,
}
```
