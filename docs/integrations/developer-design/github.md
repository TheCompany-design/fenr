# GitHub Integration Specification

## 1. Overview & Agentic Capabilities

The GitHub integration connects **Fenr** and the **Nabu** agent to repositories, code reviews, and developer workflows:
* **Pull Request Management**: Summarize PR diffs, post review comments, and check CI/CD action statuses.
* **Issue Orchestration**: Create, triage, label, and close GitHub issues linked to Fenr tasks.
* **Codebase & File Search**: Search repositories, read raw files, and inspect git commit trees for context.
* **Release & Changelog Automation**: Generate automated release notes from merged PRs and commit history.

---

## 2. OAuth 2.0 vs GitHub App Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      GITHUB INTEGRATION ARCHITECTURE                        │
│                                                                             │
│  [Pattern A: User OAuth (via Better-Auth github provider)]                  │
│  • Best for user-acting actions (personal stars, personal commits).         │
│  • Scopes: repo, read:user, read:org.                                       │
│                                                                             │
│  [Pattern B: GitHub App (Recommended for Organizations)]                    │
│  • Installed once on organization or selected repositories.                 │
│  • Higher rate limits (5,000 req/hr per installation).                      │
│  • Fine-grained permissions; no access to personal private repos.           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Compliance & Security Review
* **Compliance Tier**: **Tier 1 (Permissive / Self-Serve)**.
* **Audit Requirement**: **None**. GitHub Apps and OAuth apps have zero external audit fees or mandatory security assessments.

### Recommended GitHub App Permissions

| Permission | Access | Purpose |
| :--- | :--- | :--- |
| `Pull requests` | Read & Write | Read diffs, submit PR reviews, merge PRs. |
| `Issues` | Read & Write | Read, create, label, and comment on issues. |
| `Contents` | Read & Write | Read file trees, inspect commits, commit file updates. |
| `Actions` | Read-only | Monitor GitHub Actions workflow run statuses. |

---

## 3. Core API Endpoints & Payload Contracts

All endpoints target GitHub REST API: `https://api.github.com/`.

### A. Create or Comment on Pull Request
* **Endpoint**: `POST /repos/{owner}/{repo}/issues/{pull_number}/comments`
* **Payload**:
  ```json
  {
    "body": "### Nabu Automated Review\n- **Security**: No secrets detected.\n- **Performance**: Optimized SQL query on line 42."
  }
  ```

### B. Read File Content from Repository
* **Endpoint**: `GET /repos/{owner}/{repo}/contents/{path}?ref={branch}`
* **Response**: Returns Base64-encoded file content and SHA hash.

### C. Create an Issue with Labels
* **Endpoint**: `POST /repos/{owner}/{repo}/issues`
* **Payload**:
  ```json
  {
    "title": "Fix Biome linter rule violations in ui package",
    "body": "Identified unused import statements during turbo check.",
    "labels": ["bug", "tooling"],
    "assignees": ["muchiri"]
  }
  ```

---

## 4. Inbound Webhooks

GitHub sends rich event payloads:

* **Endpoint**: `POST https://app.fenr.com/api/webhooks/github`
* **Subscribed Events**:
  * `pull_request` (opened, closed, review_requested)
  * `issues` (opened, labeled)
  * `push`
  * `workflow_run` (completed)
* **HMAC Verification**:
  * Extract `X-Hub-Signature-256`.
  * Compute HMAC SHA-256 of raw body with GitHub Webhook Secret and verify in constant time.

---

## 5. Rate Limits & Quotas

* **GitHub App Installations**: 5,000 requests per hour per installation.
* **User OAuth**: 5,000 requests per hour for authenticated requests.
* **Search API**: Stricter limit of 30 requests per minute.

---

## 6. Nabu Tool Definition (Rust Agent Schema)

```rust
pub struct GitHubCreateIssueArgs {
    pub owner: String,
    pub repo: String,
    pub title: String,
    pub body_markdown: String,
    pub labels: Vec<String>,
}

pub struct GitHubGetFileContentArgs {
    pub owner: String,
    pub repo: String,
    pub path: String,
    pub branch_or_sha: Option<String>,
}
```
