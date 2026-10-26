# Slack Integration Specification

## 1. Overview & Agentic Capabilities

The Slack integration provides **bi-directional conversational presence** for the **Nabu** agent and **Fenr** platform:
* **Interactive Bot Companion**: Users can mention `@Nabu` in public/private channels or DM the bot for answers, summaries, and task creation.
* **Notification Sinks**: Stream deploy alerts, document updates, and project cycle digests into configured Slack channels.
* **Block Kit Interactive Approvals**: Render cards with buttons, date pickers, and overflow menus for human-in-the-loop approvals.
* **Thread-Scoped Context**: Nabu maintains multi-turn conversation memory tied to Slack thread timestamps (`thread_ts`).

---

## 2. OAuth 2.0 & Token Architecture (Org vs User)

Slack OAuth is distinct because the app is installed **at the Slack Workspace (Team) level**, not just the individual user level:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       SLACK TOKEN ARCHITECTURE                              │
│                                                                             │
│  [Workspace Bot Token (xoxb-...) - Stored per Fenr Organization]            │
│  • Installed once by a Slack Workspace Admin.                               │
│  • Persists in `organization_integration` table.                            │
│  • Used for posting messages, listening to mentions, and handling events.   │
│                                                                             │
│  [User Token (xoxp-...) - Optional, per Fenr User]                          │
│  • Better-Auth linked account for user identity mapping.                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Audit & Review Status
* **Review Cost**: **Free**. Slack performs an internal security and functionality review before listing on the public Slack App Directory.
* **No CASA Audit**: No third-party paid security audit is required.

### Recommended Bot Scopes (`bot` scope)

| Scope | Type | Purpose |
| :--- | :--- | :--- |
| `chat:write` | Bot | Send messages to public channels, private channels, and DMs. |
| `app_mentions:read` | Bot | Receive Events API webhook when `@Nabu` is mentioned in a channel. |
| `channels:history` | Bot | Read past messages in public channels the bot is invited to. |
| `groups:history` | Bot | Read past messages in private channels the bot is invited to. |
| `commands` | Bot | Register slash commands (e.g. `/fenr <query>`). |
| `files:write` | Bot | Upload file attachments and generated reports. |

---

## 3. Core API Endpoints & Block Kit Payloads

All calls target `https://slack.com/api/` with `Authorization: Bearer xoxb-...`.

### A. Post Block Kit Message
* **Endpoint**: `POST /chat.postMessage`
* **Payload**:
  ```json
  {
    "channel": "C0123456789",
    "text": "Nabu Sprint Summary",
    "blocks": [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "*Sprint 42 Status Update*\n3 issues completed, 1 blocked."
        }
      },
      {
        "type": "actions",
        "elements": [
          {
            "type": "button",
            "text": { "type": "plain_text", "text": "View in Fenr" },
            "url": "https://app.fenr.com/projects/sprint-42",
            "style": "primary"
          },
          {
            "type": "button",
            "text": { "type": "plain_text", "text": "Approve Deploy" },
            "action_id": "approve_deploy_btn",
            "value": "deploy_target_prod"
          }
        ]
      }
    ]
  }
  ```

### B. Reply in Thread
* **Endpoint**: `POST /chat.postMessage`
* **Payload**: Set `"thread_ts": "1727182900.123456"` to respond inline to a user question without polluting the main channel feed.

---

## 4. Inbound Webhooks & Events API

Slack pushes real-time events to Fenr:

* **Endpoint**: `POST https://app.fenr.com/api/webhooks/slack/events`
* **Security Verification**: Every Slack request must be validated using the **Slack Signing Secret**:
  1. Retrieve `X-Slack-Request-Timestamp` and `X-Slack-Signature`.
  2. Compute HMAC SHA-256 of `v0:${timestamp}:${raw_body}` using your Slack Signing Secret.
  3. Compare constant-time with `X-Slack-Signature`.
* **Event Handshake**: On setup, Slack sends an `url_verification` challenge payload (`{ "challenge": "..." }`); Fenr must immediately return `{ "challenge": "..." }`.

---

## 5. Rate Limits & Quotas

* **Tier 3 Quota**: Most chat methods allow **50 requests per minute**.
* **Throttling**: Returns `429 Too Many Requests` with `Retry-After` header.

---

## 6. Nabu Tool Definition (Rust Agent Schema)

```rust
pub struct SlackSendMessageArgs {
    pub channel_id: String,
    pub message_markdown: String,
    pub thread_ts: Option<String>,
}
```
