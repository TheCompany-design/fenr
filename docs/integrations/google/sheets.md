# Google Sheets Integration Specification

## 1. Overview & Agentic Capabilities

The Google Sheets integration enables **Fenr** and the **Nabu** agent to:
* **Query & Ingest Tabular Data**: Read cell ranges, structured tables, and CSV exports for quantitative analysis.
* **Append Row Data (Logging / CRM)**: Append agent output rows, lead records, or task metrics to existing sheets.
* **Create Dynamic Workbooks**: Generate formatted financial models, project trackers, and dashboards.
* **Formula Execution**: Insert formulas (`SUM`, `VLOOKUP`, `QUERY`) using Google Sheets calculation engine.

---

## 2. OAuth 2.0 & Scope Classification

* **Scope**: `https://www.googleapis.com/auth/spreadsheets` is classified as **Sensitive, NOT Restricted**.
* **Audit Requirement**: **Free Google Trust & Safety verification only**. No CASA Tier 2/3 paid external security audit.
* **Alternative**: `https://www.googleapis.com/auth/drive.file` covers spreadsheets created by Fenr or picked by the user, providing an even narrower security boundary.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SHEETS SCOPE OPTIONS                                │
│                                                                             │
│  [Narrow & Safe]                            [Sensitive - Free Review]       │
│  • .../auth/drive.file                      • .../auth/spreadsheets         │
│    (Workbooks created/picked by Fenr)         (Access all user sheets)      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core API Endpoints & Payload Contracts

All Sheets calls target `https://sheets.googleapis.com/v4/spreadsheets/`.

### A. Read Cell Range Values
* **Endpoint**: `GET /{spreadsheetId}/values/{range}?valueRenderOption=FORMATTED_VALUE`
* **Range Notation**: A1 notation (e.g. `Sheet1!A1:E50` or `Orders!A:F`).
* **Response**:
  ```json
  {
    "range": "Sheet1!A1:C2",
    "majorDimension": "ROWS",
    "values": [
      ["Task Name", "Status", "Assignee"],
      ["Implement OAuth", "In Progress", "Alex"]
    ]
  }
  ```

### B. Append Rows to Table
* **Endpoint**: `POST /{spreadsheetId}/values/{range}:append?valueInputOption=USER_ENTERED`
* **Payload**:
  ```json
  {
    "values": [
      ["2026-09-24", "Product Launch Sprint", "Complete", "$12,450.00"]
    ]
  }
  ```
* **Parameter**: `valueInputOption=USER_ENTERED` parses numbers, dates, and formulas automatically.

### C. Create New Spreadsheet
* **Endpoint**: `POST /spreadsheets`
* **Payload**:
  ```json
  {
    "properties": {
      "title": "Fenr Automated Analytics - Q4"
    },
    "sheets": [
      {
        "properties": {
          "title": "Overview",
          "gridProperties": { "rowCount": 100, "columnCount": 10 }
        }
      }
    ]
  }
  ```

---

## 4. Rate Limits & Quotas

* **Read Requests**: 300 requests per minute per project; 60 requests per minute per user.
* **Write Requests**: 300 requests per minute per project; 60 requests per minute per user.
* **Optimization**: Use batch endpoints (`values:batchGet`, `values:batchUpdate`) to combine cell reads/writes into single HTTP payloads.

---

## 5. Nabu Tool Definition (Rust Agent Schema)

```rust
pub struct SheetsReadRangeArgs {
    pub spreadsheet_id: String,
    pub range_a1: String, // e.g. "Sheet1!A1:D20"
}

pub struct SheetsAppendRowsArgs {
    pub spreadsheet_id: String,
    pub sheet_name: String,
    pub rows: Vec<Vec<serde_json::Value>>,
}
```
