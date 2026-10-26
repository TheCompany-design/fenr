# LinkedIn Integration Specification

## 1. Overview & Agentic Capabilities

The LinkedIn integration connects **Fenr** and the **Nabu** agent to professional publishing and organization workflows:
* **Automated Social Publishing**: Draft and publish product announcements, technical blogs, and release notes to personal profiles or company pages.
* **Content Generation & Scheduling**: Use Fenr document artifacts to generate LinkedIn post drafts with formatted hashtags and media attachments.
* **Engagement Analytics**: Retrieve impression, like, and comment metrics on published posts.

---

## 2. OAuth 2.0 & Scope Classification (Practical vs Gated)

LinkedIn has strict partner tiers. Distinguishing self-serve permissions from gated enterprise permissions is critical:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LINKEDIN SCOPE BOUNDARIES                            │
│                                                                             │
│  [Self-Serve & Practical - Free Approval]                                   │
│  • openid, profile, email (OIDC Identity)                                   │
│  • w_member_social (Publish posts on member's personal feed)                │
│  • w_organization_social (Publish posts on company organization pages)      │
│  • r_organization_social (Read company page post analytics)                 │
│                                                                             │
│  [Gated Enterprise Scopes - Restricted Partner Program - AVOID]             │
│  • Direct 1:1 InMail / Messaging API (Requires Enterprise Recruiter Partner) │
│  • CRM / Lead Sync (Requires Sales Navigator Partner Agreement)             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Scopes

| Scope | Type | Purpose | Approval Level |
| :--- | :--- | :--- | :--- |
| `openid` | OIDC | Verify LinkedIn identity. | Self-Serve |
| `profile` | OIDC | Retrieve member name and profile image. | Self-Serve |
| `w_member_social` | OAuth | Post updates and articles to personal feed. | Self-Serve ("Share on LinkedIn") |
| `w_organization_social` | OAuth | Post updates to organization pages (admin rights required). | Free Review ("Community Management API") |

---

## 3. Core API Endpoints & Payload Contracts

All endpoints target LinkedIn REST API: `https://api.linkedin.com/rest/` with header `LinkedIn-Version: 202401`.

### A. Fetch Member URN
* **Endpoint**: `GET https://api.linkedin.com/v2/userinfo`
* **Response**: Returns `sub` (e.g. `urn:li:person:abcdef123`).

### B. Publish Text Post with Link Preview
* **Endpoint**: `POST /posts`
* **Headers**:
  * `Authorization: Bearer <access_token>`
  * `LinkedIn-Version: 202401`
  * `X-Restli-Protocol-Version: 2.0.0`
* **Payload**:
  ```json
  {
    "author": "urn:li:person:abcdef123",
    "commentary": "Excited to introduce our new architecture documentation in Fenr! Check out the specs here.",
    "visibility": "PUBLIC",
    "distribution": {
      "feedDistribution": "MAIN_FEED",
      "targetEntities": [],
      "thirdPartyDistributionChannels": []
    },
    "content": {
      "article": {
        "source": "https://fenr.com/blog/architecture",
        "title": "Fenr Platform Architecture",
        "description": "Deep-dive into TanStack Start, Bun, and Rust Nabu agent runtime."
      }
    },
    "lifecycleState": "PUBLISHED"
  }
  ```
* **Response**: Returns `201 Created` with post URN (`urn:li:share:7123456789`).

---

## 4. Rate Limits & Quotas

* **Member Publishing**: Maximum 25 posts per 24 hours per member.
* **Organization Publishing**: Maximum 100 posts per 24 hours per company page.
* **API Throttling**: Standard limit of 100 requests per minute.

---

## 5. Nabu Tool Definition (Rust Agent Schema)

```rust
pub struct LinkedInPublishPostArgs {
    pub author_urn: String, // "urn:li:person:..." or "urn:li:organization:..."
    pub text_commentary: String,
    pub article_url: Option<String>,
    pub article_title: Option<String>,
}
```
