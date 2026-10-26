# Linear Integration Specification

## 1. Overview & Agentic Capabilities

The Linear integration gives **Fenr** and the **Nabu** agent full project management capabilities via Linear's **GraphQL API**:
* **Issue Triage & Creation**: Automatically create, assign, and estimate issues from Fenr meeting notes or user prompts.
* **Cycle & Project Progress Tracking**: Query active cycles, roadmaps, and project health metrics.
* **Bi-directional Comment Sync**: Post progress updates, AI code review summaries, and PR links directly into Linear issue threads.
* **Workflow State Transitions**: Move issues between states (`Backlog`, `In Progress`, `In Review`, `Done`).

---

## 2. OAuth 2.0 & Scope Classification

* **Better-Auth Support**: Built-in `linear` provider.
* **Compliance Tier**: **Tier 1 (Permissive / Self-Serve)**.
* **Audit Requirement**: **None**. Linear does not require security assessments or verification fees.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          LINEAR OAUTH SCOPES                                │
│                                                                             │
│  [Immediate Self-Serve - Zero Friction]                                     │
│  • read (Query teams, projects, cycles, issues)                             │
│  • write (Create/update issues, post comments, change status)                │
│  • issues:create (Narrower scope if write access is restricted)             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Scopes

| Scope | Type | Purpose |
| :--- | :--- | :--- |
| `read` | OAuth | Query issues, projects, teams, cycles, and users. |
| `write` | OAuth | Create/update issues, modify states, add attachments. |

---

## 3. GraphQL Operations & Contracts

Linear uses a single GraphQL endpoint: `POST https://api.linear.app/graphql`.

### A. Create an Issue
* **GraphQL Mutation**:
  ```graphql
  mutation CreateIssue($teamId: String!, $title: String!, $description: String, $priority: Int) {
    issueCreate(input: {
      teamId: $teamId,
      title: $title,
      description: $description,
      priority: $priority
    }) {
      success
      issue {
        id
        identifier
        url
        title
        state { name }
      }
    }
  }
  ```

### B. Query User's Assigned Issues in Active Cycle
* **GraphQL Query**:
  ```graphql
  query MyActiveIssues {
    viewer {
      assignedIssues(filter: { state: { type: { neq: "completed" } } }) {
        nodes {
          id
          identifier
          title
          priority
          cycle { number startsAt endsAt }
        }
      }
    }
  }
  ```

### C. Update Issue Workflow State
* **GraphQL Mutation**:
  ```graphql
  mutation UpdateIssueState($issueId: String!, $stateId: String!) {
    issueUpdate(id: $issueId, input: { stateId: $stateId }) {
      success
      issue { id identifier state { name } }
    }
  }
  ```

---

## 4. Inbound Webhooks

Linear streams events when issues, comments, or cycles change:

* **Endpoint**: `POST https://app.fenr.com/api/webhooks/linear`
* **HMAC Verification**:
  * Linear sends `Linear-Signature` in headers.
  * Compute HMAC SHA-256 of the raw body using your Linear Webhook Secret and verify in constant-time.
* **Event Payloads**: Inspect `action` (`create`, `update`, `remove`) and `type` (`Issue`, `Comment`, `Project`).

---

## 5. Rate Limits & Quotas

* **Complexity Limit**: Maximum 250,000 query complexity points per hour.
* **Burst Limit**: Maximum 1,440 requests per minute.
* **Header Inspection**: Linear returns `X-RateLimit-Requests-Remaining` and `X-RateLimit-Complexity-Remaining`.

---

## 6. Nabu Tool Definition (Rust Agent Schema)

```rust
pub struct LinearCreateIssueArgs {
    pub team_key: String, // e.g. "ENG"
    pub title: String,
    pub description_markdown: Option<String>,
    pub priority: Option<u8>, // 0 = None, 1 = Urgent, 2 = High, 3 = Normal, 4 = Low
}

pub struct LinearUpdateStatusArgs {
    pub issue_id: String,
    pub target_state_name: String, // e.g. "In Progress", "Done"
}
```
