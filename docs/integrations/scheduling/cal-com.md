# Cal.com Integration Specification

## 1. Overview & Agentic Capabilities

The Cal.com integration provides open scheduling infrastructure for **Fenr** and the **Nabu** agent:
* **Autonomous Booking**: Nabu can find open availability and book meetings on behalf of clients or internal team members.
* **Dynamic Event Type Management**: Configure duration, buffer times, locations (Google Meet, Zoom, phone), and custom booking questions.
* **Schedule Overrides & Working Hours**: Dynamically adjust availability based on Fenr sprint deadlines and focus time.
* **Webhook Event Ingestion**: Automatically trigger downstream onboarding or document creation when a booking is confirmed.

---

## 2. OAuth 2.0 & API Key Architecture

* **Authentication Models**:
  * **API Key (Simplest)**: User or Organization-level API key (`cal_live_...`).
  * **OAuth 2.0**: Implemented via Better-Auth `genericOAuth` plugin against Cal.com Cloud or self-hosted instances.
* **Compliance Tier**: **Tier 1 (Permissive / Self-Serve)**.
* **Audit Requirement**: **None**. Fully open-source ecosystem without security assessments or review fees.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CAL.COM AUTH OPTIONS                               │
│                                                                             │
│  [Option 1: API Key - Immediate & Direct]                                  │
│  • Pass `Authorization: Bearer cal_live_...` or `x-cal-secret-key`          │
│                                                                             │
│  [Option 2: OAuth 2.0 via Better-Auth genericOAuth]                         │
│  • Auth URL: https://app.cal.com/auth/oauth2/authorize                      │
│  • Token URL: https://api.cal.com/v2/auth/oauth2/token                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core API Endpoints & Payload Contracts

All endpoints target Cal.com v2 API: `https://api.cal.com/v2/`.

### A. Query Available Slots
* **Endpoint**: `GET /slots/available?startTime={iso}&endTime={iso}&eventTypeId={id}`
* **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "slots": {
        "2026-09-28": [
          { "time": "2026-09-28T14:00:00.000Z" },
          { "time": "2026-09-28T14:30:00.000Z" }
        ]
      }
    }
  }
  ```

### B. Create a Booking
* **Endpoint**: `POST /bookings`
* **Payload**:
  ```json
  {
    "start": "2026-09-28T14:00:00.000Z",
    "eventTypeId": 128491,
    "attendee": {
      "name": "Jane Doe",
      "email": "jane@client.com",
      "timeZone": "America/New_York"
    },
    "metadata": {
      "fenr_lead_id": "lead_981a2f"
    }
  }
  ```
* **Response**: Returns booking status, unique UID, and meeting video link.

---

## 4. Inbound Webhooks

Cal.com triggers webhooks for booking lifecycle updates:

* **Endpoint**: `POST https://app.fenr.com/api/webhooks/cal-com`
* **Supported Triggers**:
  * `BOOKING_CREATED`
  * `BOOKING_RESCHEDULED`
  * `BOOKING_CANCELLED`
* **Signature Verification**: Validate `X-Cal-Signature-256` header (HMAC SHA-256 with webhook secret).

---

## 5. Rate Limits & Quotas

* **Cal Cloud Rate Limit**: 120 requests per minute per API key.
* **Self-Hosted**: Unlimited (configured at reverse-proxy / server level).

---

## 6. Nabu Tool Definition (Rust Agent Schema)

```rust
pub struct CalComBookSlotArgs {
    pub event_type_id: i64,
    pub start_iso: String,
    pub attendee_name: String,
    pub attendee_email: String,
    pub timezone: String,
}
```
