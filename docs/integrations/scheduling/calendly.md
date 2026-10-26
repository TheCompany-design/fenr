# Calendly Integration Specification

## 1. Overview & Agentic Capabilities

The Calendly integration connects **Fenr** and the **Nabu** agent to Calendly's scheduling infrastructure:
* **Event Type Inspection**: Fetch public booking links, active event types, and durations.
* **Scheduled Event Ingestion**: Query upcoming meetings, invitee answers, and cancellation statuses.
* **Meeting Cancellation**: Cancel scheduled meetings with contextual reason messages on behalf of the host.
* **Webhook Workflow Triggers**: Trigger Fenr document generation and CRM record creation upon invitee scheduling.

---

## 2. OAuth 2.0 & Scope Classification

* **Better-Auth Support**: Implemented via the `genericOAuth` plugin.
  * **Auth URL**: `https://auth.calendly.com/oauth/authorize`
  * **Token URL**: `https://auth.calendly.com/oauth/token`
* **Compliance Tier**: **Tier 1 / Tier 2 (Self-Serve)**.
* **Audit Requirement**: **None**. Calendly requires app registration and optional directory review, with zero third-party audit fees.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CALENDLY OAUTH SCOPES                              │
│                                                                             │
│  • default (Standard OAuth 2.0 user-level access)                          │
│  • Refresh tokens rotate upon use; store updated refresh tokens in account  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core API Endpoints & Payload Contracts

All endpoints target `https://api.calendly.com/`.

### A. Fetch Current User & Organization URI
* **Endpoint**: `GET /users/me`
* **Response**: Returns `uri` (e.g. `https://api.calendly.com/users/UUID`) and `current_organization`.

### B. List User Event Types
* **Endpoint**: `GET /event_types?user={user_uri}&active=true`
* **Response**:
  ```json
  {
    "collection": [
      {
        "uri": "https://api.calendly.com/event_types/UUID",
        "name": "30 Minute Strategy Session",
        "scheduling_url": "https://calendly.com/user/30min",
        "duration": 30,
        "kind": "solo"
      }
    ]
  }
  ```

### C. List Scheduled Events
* **Endpoint**: `GET /scheduled_events?user={user_uri}&status=active&min_start_time={iso}`
* **Response**: Chronological list of scheduled meetings with invitee details.

### D. Cancel Scheduled Meeting
* **Endpoint**: `POST /scheduled_events/{event_uuid}/cancellation`
* **Payload**:
  ```json
  {
    "reason": "Rescheduled due to sprint deadline alignment in Fenr."
  }
  ```

---

## 4. Inbound Webhooks

* **Endpoint**: `POST https://app.fenr.com/api/webhooks/calendly`
* **Subscription Creation**: `POST /webhook_subscriptions` specifying `invitee.created` and `invitee.canceled`.
* **Signature Verification**: Inspect `Calendly-Webhook-Signature`. Extract `t` (timestamp) and `v1` (signature). Verify HMAC SHA-256 against webhook signing key.

---

## 5. Rate Limits & Quotas

* **Limit**: 100 requests per minute per access token.
* **Handling**: Standard exponential backoff on `429 Too Many Requests`.

---

## 6. Nabu Tool Definition (Rust Agent Schema)

```rust
pub struct CalendlyListUpcomingMeetingsArgs {
    pub min_start_time_iso: String,
    pub max_results: Option<u32>,
}

pub struct CalendlyCancelMeetingArgs {
    pub event_uuid: String,
    pub cancellation_reason: String,
}
```
