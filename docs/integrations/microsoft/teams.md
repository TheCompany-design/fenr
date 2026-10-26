# Microsoft Teams Integration Specification

## 1. Overview & Agentic Capabilities

The Microsoft Teams integration allows **Fenr** and the **Nabu** agent to:
* **Post Notifications & Briefs**: Send rich Adaptive Cards into company Teams channels and private chats.
* **Bi-directional Agent Conversations**: Mention `@Nabu` in a Teams channel to initiate an agent workflow or answer queries.
* **Human-in-the-Loop Approvals**: Send interactive approval cards with actionable buttons directly inside Teams.
* **Meeting Collaboration**: Join Teams meeting chats and summarize agenda action items.

---

## 2. OAuth 2.0 & Scope Classification

* **Platform**: Microsoft Entra ID / Microsoft Graph & Azure Bot Service.
* **Audit Requirement**: **Free Publisher Verification**. No third-party CASA lab fee.
* **Delegated vs Application Scopes**:
  * For acting as the signed-in user: Delegated scopes (`ChatMessage.Send`, `ChannelMessage.Send`).
  * For a dedicated Nabu Bot: Azure Bot Framework registration with bot application credentials.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TEAMS GRAPH SCOPES                                 │
│                                                                             │
│  [User Delegated - Free Verification]       [Admin Consent Required]        │
│  • ChannelMessage.Send                      • ChannelMessage.Read.All       │
│  • ChatMessage.Send                         • Chat.ReadWrite.All            │
│  • Team.ReadBasic.All                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Scopes

| Scope | Type | Purpose | Consent Level |
| :--- | :--- | :--- | :--- |
| `ChannelMessage.Send` | Delegated | Send messages to public/private channels user belongs to. | User / Admin |
| `ChatMessage.Send` | Delegated | Send 1:1 and group chat messages on behalf of user. | User / Admin |
| `Team.ReadBasic.All` | Delegated | Read names and descriptions of teams the user is in. | User / Admin |

---

## 3. Core API Endpoints & Payload Contracts

All Teams Graph calls target `https://graph.microsoft.com/v1.0/`.

### A. Send Channel Message (HTML / Markdown)
* **Endpoint**: `POST /teams/{teamId}/channels/{channelId}/messages`
* **Payload**:
  ```json
  {
    "body": {
      "contentType": "html",
      "content": "<strong>Fenr Alert:</strong> Sprint 43 deployment was successful."
    }
  }
  ```

### B. Send Interactive Adaptive Card
* **Endpoint**: `POST /teams/{teamId}/channels/{channelId}/messages`
* **Payload**:
  ```json
  {
    "body": {
      "contentType": "html",
      "content": "<attachment id=\"adaptiveCardAttachment\"></attachment>"
    },
    "attachments": [
      {
        "id": "adaptiveCardAttachment",
        "contentType": "application/vnd.microsoft.card.adaptive",
        "content": "{\"type\":\"AdaptiveCard\",\"version\":\"1.4\",\"body\":[{\"type\":\"TextBlock\",\"text\":\"Approve PR #104?\",\"weight\":\"Bolder\"}],\"actions\":[{\"type\":\"Action.Submit\",\"title\":\"Approve\",\"data\":{\"action\":\"approve\",\"prId\":\"104\"}}]}"
      }
    ]
  }
  ```

---

## 4. Bot Framework & Real-time Mentions

For real-time conversational triggers (`@Nabu` in channel):
1. Register an **Azure Bot Service** resource associated with your Entra App ID.
2. Configure the Teams channel messaging endpoint to `https://app.fenr.com/api/webhooks/microsoft/teams/bot`.
3. Handle incoming JSON activity payloads (`type: "message"`). Validate the Azure Bot Framework JWT in the `Authorization` header.

---

## 5. Rate Limits & Quotas

* **Teams Graph Limit**: Maximum 4 requests per second per thread / conversation.
* **Throttling Response**: `429 Too Many Requests` with `Retry-After`.

---

## 6. Nabu Tool Definition (Rust Agent Schema)

```rust
pub struct TeamsPostChannelMessageArgs {
    pub team_id: String,
    pub channel_id: String,
    pub message_html: String,
}
```
