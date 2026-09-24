# QuickBooks Online Integration Specification (Intuit)

## 1. Overview & Agentic Capabilities

The QuickBooks Online integration connects **Fenr** and the **Nabu** agent to financial and accounting workflows:
* **Automated Invoicing**: Generate and send professional invoices based on Fenr project milestones, timesheets, or retainer agreements.
* **Customer Synchronization**: Read and sync customer records, tax IDs, and billing contacts.
* **Payment & Accounts Receivable Tracking**: Query unpaid invoices, overdue balances, and recent payment settlements for project dashboards.
* **Expense Logging**: Record categorized project expenses and vendor bills.

---

## 2. OAuth 2.0 & Token Architecture (Intuit Developer)

* **Better-Auth Support**: Implemented via the `genericOAuth` plugin.
  * **Auth URL**: `https://appcenter.intuit.com/connect/oauth2`
  * **Token URL**: `https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer`
* **Crucial Parameter (`realmId`)**: Intuit returns a `realmId` query parameter during the OAuth callback representing the QuickBooks Company ID. Fenr must store `realmId` alongside the access/refresh token in the database.

### Compliance & Security Review
* **Compliance Tier**: **Tier 2 / Tier 3 (Intuit App Assessment)**.
* **Audit Requirement**: **None**. Intuit requires an annual self-serve security questionnaire and automated TLS/security checks through the Intuit Developer portal, but **no mandatory paid CASA third-party lab audit**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INTUIT OAUTH SCOPES                                 │
│                                                                             │
│  • com.intuit.quickbooks.accounting (Invoices, Customers, Payments)         │
│  • com.intuit.quickbooks.payment (Credit card & ACH processing)             │
│  • openid, profile, email (Intuit SSO)                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Scopes

| Scope | Type | Purpose |
| :--- | :--- | :--- |
| `com.intuit.quickbooks.accounting` | OAuth | Full accounting read/write (Invoices, Customers, Accounts). |

---

## 3. Core API Endpoints & Payload Contracts

All endpoints target `https://quickbooks.api.intuit.com/v3/company/{realmId}/` (or `https://sandbox-quickbooks.api.intuit.com/` for sandbox). Header `Accept: application/json` is required.

### A. Create an Invoice
* **Endpoint**: `POST /invoice`
* **Payload**:
  ```json
  {
    "CustomerRef": {
      "value": "1",
      "name": "Acme Corp"
    },
    "Line": [
      {
        "DetailType": "SalesItemLineDetail",
        "Amount": 4500.00,
        "SalesItemLineDetail": {
          "ItemRef": { "value": "2", "name": "Design & Engineering Services" },
          "UnitPrice": 150.00,
          "Qty": 30
        },
        "Description": "Sprint 42 implementation in Fenr."
      }
    ],
    "DueDate": "2026-10-15"
  }
  ```
* **Response**: Returns `Id` (Invoice ID), `DocNumber`, and `TotalAmt`.

### B. Query Unpaid Invoices
* **Endpoint**: `GET /query?query=select * from Invoice where Balance > '0' order by DueDate`
* **Response**: JSON array of unpaid invoices with outstanding balances and customer references.

### C. Find or Create Customer
* **Endpoint**: `POST /customer`
* **Payload**:
  ```json
  {
    "DisplayName": "Acme Corp",
    "PrimaryEmailAddr": { "Address": "billing@acme.com" },
    "CompanyName": "Acme Corporation"
  }
  ```

---

## 4. Inbound Webhooks

QuickBooks Online sends real-time change notifications:

* **Endpoint**: `POST https://app.fenr.com/api/webhooks/quickbooks`
* **Payload**: Contains `eventNotifications[]` with changed entities (`Invoice`, `Payment`, `Customer`).
* **Signature Verification**: Validate `intuit-signature` header using HMAC SHA-256 with the Intuit Webhook Token.

---

## 5. Rate Limits & Token Rotation

* **Rate Limit**: 500 requests per minute per realm (company).
* **Refresh Token Rotation**: Intuit refresh tokens have a rolling 100-day lifespan. Each time a token is refreshed, Intuit returns a new `refresh_token`. Ensure the new refresh token is saved to the database immediately to prevent synchronization failure.

---

## 6. Nabu Tool Definition (Rust Agent Schema)

```rust
pub struct QuickBooksCreateInvoiceArgs {
    pub customer_id: String,
    pub line_items: Vec<QuickBooksLineItem>,
    pub due_date: chrono::NaiveDate,
    pub customer_memo: Option<String>,
}

pub struct QuickBooksLineItem {
    pub item_name: String,
    pub quantity: f64,
    pub unit_price: f64,
    pub description: String,
}
```
