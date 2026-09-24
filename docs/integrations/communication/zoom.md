# Zoom Integration Specification

## 1. Overview & Agentic Capabilities

The Zoom integration allows **Fenr** and the **Nabu** agent to:
* **Schedule & Update Video Meetings**: Create meetings with auto-generated passwords, waiting rooms, and join URLs.
* **Retrieve Cloud Recordings & Audio**: Access audio files (`.m4a`) and video files for post-call processing.
* **Ingest Transcripts & AI Summaries**: Download Zoom native meeting transcripts (`.vtt`) and Zoom AI Companion summaries to feed directly into Fenr project notes.
* **Meeting Participant Tracking**: Log participant attendance and meeting durations.

---

## 2. OAuth 2.0 & Scope Classification

* **Better-Auth Support**: Built-in `zoom` provider.
* **OAuth Types**:
  * **User-level OAuth**: Users connect their personal Zoom account to schedule on their own calendar.
  * **Server-to-Server OAuth**: Organization-wide integration installed by a Zoom Admin for company-wide scheduling and recording ingestion.

### Audit & Security Review Status
* **Zoom Marketplace Review**: Requires functional review and an automated security scan before publishing publicly.
* **Audit Fee**: **None (Free)**. Zoom does not mandate a paid third-party CASA audit for standard meeting and recording scopes.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ZOOM OAUTH SCOPES                                 │
│                                                                             │
│  [User Delegated - Free Review]             [Admin Level - Server-to-Server]│
│  • meeting:write                            • meeting:write:admin           │
│  • meeting:read                             • recording:read:admin          │
│  • recording:read                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Scopes

| Scope | Type | Purpose |
| :--- | :--- | :--- |
| `meeting:write` | User | Create, update, and delete meetings. |
| `meeting:read` | User | View meeting details and participant lists. |
| `recording:read` | User | Access cloud recordings and transcript files. |

---

## 3. Core API Endpoints & Payload Contracts

All Zoom REST endpoints target `https://api.zoom.us/v2/`.

### A. Create Scheduled Meeting
* **Endpoint**: `POST /users/me/meetings`
* **Payload**:
  ```json
  {
    "topic": "Fenr Sprint Planning",
    "type": 2,
    "start_time": "2026-09-29T15:00:00Z",
    "duration": 45,
    "timezone": "UTC",
    "settings": {
      "host_video": true,
      "participant_video": true,
      "join_before_host": false,
      "waiting_room": true,
      "auto_recording": "cloud"
    }
  }
  ```
* **Response**: Returns `join_url`, `start_url`, `password`, and numeric `id`.

### B. Fetch Cloud Recordings & Transcripts
* **Endpoint**: `GET /meetings/{meetingId}/recordings`
* **Response**:
  ```json
  {
    "recording_files": [
      {
        "file_type": "MP4",
        "download_url": "https://api.zoom.us/recording/download/..."
      },
      {
        "file_type": "TRANSCRIPT",
        "download_url": "https://api.zoom.us/recording/download/...vtt"
      }
    ]
  }
  ```

---

## 4. Inbound Webhooks & Event Subscriptions

Zoom pushes real-time event webhooks:

* **Endpoint**: `POST https://app.fenr.com/api/webhooks/zoom`
* **Subscribed Events**:
  * `meeting.ended`
  * `recording.completed`
  * `recording.transcript_completed`
* **Validation Handshake**:
  * Zoom sends an `endpoint.url_validation` event with a `plainToken`.
  * Fenr must hash the `plainToken` with the Zoom Secret Token using HMAC SHA-256 and return `{ "plainToken": "...", "encryptedToken": "..." }`.

---

## 5. Rate Limits & Quotas

* **Standard User Limit**: 100 requests per second across all endpoints.
* **Meeting Creation**: Maximum 100 meeting create requests per user per day.

---

## 6. Nabu Tool Definition (Rust Agent Schema)

```rust
pub struct ZoomCreateMeetingArgs {
    pub topic: String,
    pub start_time: chrono::DateTime<chrono::Utc>,
    pub duration_minutes: u32,
    pub enable_cloud_recording: bool,
}
```
