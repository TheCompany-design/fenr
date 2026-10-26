# Microsoft Excel Integration Specification

## 1. Overview & Agentic Capabilities

The Microsoft Excel integration allows **Fenr** and the **Nabu** agent to interact with cloud Excel workbooks (`.xlsx`) via the **Microsoft Graph Excel REST API**:
* **Read Structured Tables & Ranges**: Query cell data, named ranges, and table rows.
* **Append Transactions & Rows**: Add automated log entries, expense records, or CRM updates to structured Excel tables.
* **Execute Workbook Calculations**: Recalculate financial models and retrieve computed outputs directly from the Excel calculation engine.
* **Chart & Pivot Table Generation**: Programmatically generate charts and summaries inside existing workbooks.

---

## 2. OAuth 2.0 & Scope Classification

* **Platform**: Microsoft Entra ID / Microsoft Graph.
* **Audit Requirement**: **No paid third-party audit**.
* **Scope**: Covered entirely under standard `Files.ReadWrite` (Delegated). There is no distinct "Excel" scope; Excel REST operations execute against `driveItem` resources.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EXCEL GRAPH SCOPE                                  │
│                                                                             │
│  • Files.ReadWrite (Standard user consent, free publisher verification)     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core API Endpoints & Payload Contracts

All Excel endpoints target `https://graph.microsoft.com/v1.0/me/drive/items/{driveItemId}/workbook/`.

### A. Read Cell Range Values
* **Endpoint**: `GET /worksheets/{sheetName}/range(address='A1:D25')`
* **Response**:
  ```json
  {
    "address": "Sheet1!A1:D25",
    "text": [
      ["SKU", "Item Name", "Units", "Revenue"],
      ["PROD-01", "Enterprise License", "5", "$25,000"]
    ],
    "values": [
      ["SKU", "Item Name", "Units", "Revenue"],
      ["PROD-01", "Enterprise License", 5, 25000]
    ]
  }
  ```

### B. Append Row to an Excel Table
* **Endpoint**: `POST /tables/{tableName}/rows/add`
* **Payload**:
  ```json
  {
    "values": [
      ["2026-09-24", "Engineering Audit", "Completed", 8500]
    ]
  }
  ```

### C. Update Cell Range Values & Formulas
* **Endpoint**: `PATCH /worksheets/{sheetName}/range(address='E2:E20')`
* **Payload**:
  ```json
  {
    "formulas": [
      ["=C2*D2"],
      ["=C3*D3"]
    ]
  }
  ```

---

## 4. Rate Limits & Quotas

* **Workbook Concurrency**: Excel files can lock if multiple processes write concurrently. Graph handles short-term sessions, but concurrent writes to the same workbook file should be serialized by Nabu.
* **Session Management**: For intense multi-step updates, open a workbook session via `POST /createSession` with `persistChanges: true` to avoid reopening the file on every call.

---

## 5. Nabu Tool Definition (Rust Agent Schema)

```rust
pub struct ExcelReadRangeArgs {
    pub file_id: String,
    pub sheet_name: String,
    pub cell_range: String, // e.g. "A1:F50"
}

pub struct ExcelAppendTableRowArgs {
    pub file_id: String,
    pub table_name: String,
    pub row_values: Vec<serde_json::Value>,
}
```
