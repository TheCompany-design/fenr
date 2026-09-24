# WhatsApp Integration Specification (Meta Cloud API)

## 1. Overview & Agentic Capabilities

The WhatsApp integration connects **Fenr** and the **Nabu** agent to users via the **Meta WhatsApp Cloud API**:
* **Mobile Agent Concierge**: Clients or team members can message a dedicated WhatsApp business number to query Fenr, get meeting briefs, or receive urgent alerts.
* **Customer Support & Inquiry Routing**: Ingest incoming WhatsApp inquiries, auto-respond via Nabu, or route complex questions to team members.
* **Proactive Status Alerts**: Deliver critical system notifications, invoice links, or deployment warnings directly to mobile devices.

---

## 2. Authentication & Verification Architecture (Meta Business)

WhatsApp integration **does NOT use traditional end-user OAuth**. It uses **Meta Business Platform Credentials**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       WHATSAPP CLOUD API SETUP                              │
│                                                                             │
│  1. Meta Business Account & App Creation                                    │
│  2. Meta Business Verification (DUNS, certificate of incorporation)         │
│  3. Permanent System User Access Token (Stored in Fenr organization config) │
│  4. Dedicated Phone Number & WABA (WhatsApp Business Account) ID            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Verification & Compliance Requirements
* **Audit Fee**: **None (Free)**, but requires formal **Meta Business Verification** (submitting legal corporate documents and utility bills).
* **24-Hour Messaging Policy**:
  * **Customer-Initiated (Free-form)**: When a user messages the WhatsApp number, a **24-hour service window** opens. Nabu can send free-form text, documents, audio, and interactive buttons without restriction.
  * **Business-Initiated (Templates)**: To message a user outside the 24-hour window, you **must use pre-approved Message Templates** registered in the Meta WhatsApp Manager (billed per conversation).

---

## 3. Core API Endpoints & Payload Contracts

All calls target `https://graph.facebook.com/v21.0/{phone_number_id}/messages`.

### A. Send Free-Form Text (Inside 24h Window)
* **Endpoint**: `POST /messages`
* **Payload**:
  ```json
  {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "15551234567",
    "type": "text",
    "text": {
      "body": "Hi Alex! Here is your daily briefing from Fenr: You have 3 meetings today."
    }
  }
  ```

### B. Send Interactive Button Reply
* **Endpoint**: `POST /messages`
* **Payload**:
  ```json
  {
    "messaging_product": "whatsapp",
    "to": "15551234567",
    "type": "interactive",
    "interactive": {
      "type": "button",
      "body": { "text": "Do you want Nabu to draft the client proposal?" },
      "action": {
        "buttons": [
          { "type": "reply", "reply": { "id": "btn_yes", "title": "Yes, draft it" } },
          { "type": "reply", "reply": { "id": "btn_no", "title": "Not now" } }
        ]
      }
    }
  }
  ```

### C. Send Approved Outbound Template (Outside 24h Window)
* **Endpoint**: `POST /messages`
* **Payload**:
  ```json
  {
    "messaging_product": "whatsapp",
    "to": "15551234567",
    "type": "template",
    "template": {
      "name": "system_alert_v1",
      "language": { "code": "en_US" },
      "components": [
        {
          "type": "body",
          "parameters": [
            { "type": "text", "text": "Production DB Latency Spike" }
          ]
        }
      ]
    }
  }
  ```

---

## 4. Inbound Webhooks & Verification Handshake

* **Endpoint**: `POST https://app.fenr.com/api/webhooks/whatsapp`
* **Verification (GET)**: Meta sends `hub.mode=subscribe`, `hub.challenge`, and `hub.verify_token`. Fenr validates the `verify_token` and echoes `hub.challenge`.
* **Signature Verification (POST)**: Meta signs incoming JSON with `X-Hub-Signature-256`. Fenr validates the HMAC SHA-256 signature using the Meta App Secret.

---

## 5. Rate Limits & Quotas

* **Messaging Tier Limits**: Starts at 1,000 unique business-initiated conversations per 24-hour period, scaling automatically to 10k, 100k, and unlimited as quality rating remains high.
* **Throughput**: Default 80 messages per second per phone number.

---

## 6. Nabu Tool Definition (Rust Agent Schema)

```rust
pub struct WhatsAppSendMessageArgs {
    pub recipient_phone_e164: String, // e.g. "+15551234567"
    pub message_text: String,
    pub is_template: bool,
    pub template_name: Option<String>,
}
```
