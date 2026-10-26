# Microsoft Outlook Integration Specification (Mail & Calendar)

## 1. Overview & Agentic Capabilities

The Microsoft Outlook integration gives **Fenr** and the **Nabu** agent access to enterprise email and calendars via the unified **Microsoft Graph API**:
* **Read & Search Emails**: Query inbox threads, flags, categories, and priority status.
* **Draft & Send Mail**: Send emails with formatting and attachments on behalf of the user.
* **Calendar Management**: Schedule, update, and cancel Outlook meetings with Microsoft Teams links.
* **Availability Checks**: Query availability via `getSchedule` across organizational attendees.

---

## 2. OAuth 2.0 & Scope Classification

Microsoft Entra ID (Azure AD) handles permissions via **Microsoft Graph Delegated Scopes**.

### Key Difference from Google
Unlike Google, **Microsoft does NOT enforce a paid CASA third-party audit** for mail or calendar access.
Instead, Microsoft uses:
1. **Publisher Verification**: Linking your Azure App Registration to a verified Microsoft AI Cloud Partner Program account with a D-U-N-S business identifier (free).
2. **Consent Model**: Standard delegated scopes (`Mail.ReadWrite`, `Calendars.ReadWrite`) can be consented by individual users in standard tenant setups, or tenant-wide by an IT admin.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MICROSOFT GRAPH SCOPE ARCHITECTURE                       │
│                                                                             │
│  [User Consentable Delegated Scopes - Free Verification]                    │
│  • Mail.ReadWrite                                                           │
│  • Mail.Send                                                                │
│  • Calendars.ReadWrite                                                      │
│                                                                             │
│  [Admin Consent Only - Tenant Wide]                                         │
│  • Mail.Read.Shared                                                         │
│  • Organization-wide Application permissions                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Scopes

| Scope | Type | Purpose | Consent Level |
| :--- | :--- | :--- | :--- |
| `Mail.ReadWrite` | Delegated | Read, update, and organize user emails and drafts. | User / Admin |
| `Mail.Send` | Delegated | Send email on behalf of the signed-in user. | User / Admin |
| `Calendars.ReadWrite` | Delegated | Create and manage calendar appointments. | User / Admin |
| `offline_access` | Delegated | Obtain refresh tokens for background offline operations. | User |

---

## 3. Core API Endpoints & Payload Contracts

All calls target `https://graph.microsoft.com/v1.0/me/`.

### A. List Recent Messages
* **Endpoint**: `GET /messages?$top=20&$filter=isRead eq false&$select=id,subject,from,receivedDateTime,bodyPreview`
* **OData Filtering**: Full support for OData queries (`$filter`, `$orderby`, `$search`).

### B. Send an Email
* **Endpoint**: `POST /sendMail`
* **Payload**:
  ```json
  {
    "message": {
      "subject": "Follow-up: Q4 Planning",
      "body": {
        "contentType": "HTML",
        "content": "<p>Hi team, here are the action items from today's discussion.</p>"
      },
      "toRecipients": [
        {
          "emailAddress": { "address": "client@enterprise.com" }
        }
      ]
    },
    "saveToSentItems": "true"
  }
  ```

### C. Create Calendar Event with Microsoft Teams Meeting
* **Endpoint**: `POST /events`
* **Payload**:
  ```json
  {
    "subject": "Strategic Alignment Sync",
    "start": {
      "dateTime": "2026-09-28T10:00:00",
      "timeZone": "UTC"
    },
    "end": {
      "dateTime": "2026-09-28T10:30:00",
      "timeZone": "UTC"
    },
    "attendees": [
      {
        "emailAddress": { "address": "colleague@enterprise.com" },
        "type": "required"
      }
    ],
    "isOnlineMeeting": true,
    "onlineMeetingProvider": "teamsForBusiness"
  }
  ```
* **Response**: Automatically includes the `onlineMeeting.joinUrl` for Teams.

---

## 4. Ingestion & Webhooks (Graph Change Notifications)

Microsoft Graph supports change notifications pushed directly to Fenr:

* **Subscription Endpoint**: `POST https://graph.microsoft.com/v1.0/subscriptions`
* **Payload**:
  ```json
  {
    "changeType": "created,updated",
    "notificationUrl": "https://app.fenr.com/api/webhooks/microsoft/outlook",
    "resource": "/me/messages",
    "expirationDateTime": "2026-09-30T18:23:45.9356913Z",
    "clientState": "fenr-secret-validation-token"
  }
  ```
* **Validation Handshake**: Graph sends an initial `POST` with a `validationToken` query parameter; Fenr must respond with the token as plain text `text/plain` with status `200`.

---

## 5. Rate Limits & Quotas

* **Graph Throttling Limits**: ~10,000 requests per 10-minute window per tenant.
* **Mail Send Limit**: 30 messages per minute.
* **HTTP Header on 429**: Microsoft returns `Retry-After: <seconds>`. The backend must strictly honor this header.

---

## 6. Nabu Tool Definition (Rust Agent Schema)

```rust
pub struct OutlookSendEmailArgs {
    pub to_email: String,
    pub subject: String,
    pub body_html: String,
    pub save_to_sent: bool,
}

pub struct OutlookCreateMeetingArgs {
    pub subject: String,
    pub start_time: chrono::DateTime<chrono::Utc>,
    pub end_time: chrono::DateTime<chrono::Utc>,
    pub attendees: Vec<String>,
    pub add_teams_link: bool,
}
```
