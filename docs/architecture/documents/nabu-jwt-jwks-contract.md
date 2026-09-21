# Nabu JWT & JWKS Verification Contract

## Overview

Fenr issues signed JSON Web Tokens (JWTs) for authenticated server-to-server outbound communication with downstream private services, primarily the **Nabu** engine (`thebookofnabu`).

Fenr acts as the Identity Provider (IdP) and Authorization Server for private downstream services. Nabu is a Resource Server verifying inbound requests using Fenr's public JSON Web Key Set (JWKS).

---

## Token Specifications

| Parameter | Specification | Notes |
| :--- | :--- | :--- |
| **Token Type** | JWT (`application/jwt`) | Bearer token in `Authorization: Bearer <token>` |
| **Signing Algorithm** | `EdDSA` (Curve `Ed25519`) | Asymmetric signature, secure and compact |
| **Key Management** | Better Auth JWT Plugin | Stored persistently in Fenr's PostgreSQL `jwks` table |
| **Issuer (`iss`)** | `BETTER_AUTH_URL` | e.g. `http://localhost:3000` or production URL |
| **Audience (`aud`)** | `nabu` | Strictly enforced audience claim |
| **Validity / Expiry (`exp`)** | 15 minutes (`15m`) | Bounded short lifetime; minted per request/session context |
| **Subject (`sub`)** | User UUID | Identifies the authenticated caller context |
| **Email (`email`)** | User email address | Authenticated user email |
| **Tenant (`activeOrganizationId`)** | Organization UUID | Multi-tenant context and isolation boundary |
| **Header `kid`** | UUIDv7 Key ID | Corresponds to the active key in Fenr's JWKS |

---

## Key Endpoints

### 1. JWKS Endpoint (Public Discovery)
- **URL**: `GET ${BETTER_AUTH_URL}/api/auth/jwks`
- **Authentication**: None (Public)
- **Response Format**:
  ```json
  {
    "keys": [
      {
        "alg": "EdDSA",
        "crv": "Ed25519",
        "kty": "OKP",
        "x": "...",
        "kid": "01a0c05d-b64e-790d-a823-37daf5025237"
      }
    ]
  }
  ```

### 2. Token Minting Endpoint (Fenr Server-Side Internal)
- **Method**: Internal Better Auth Server API (`auth.api.signJWT`)
- **Execution Boundary**: Server-side only (never exposed or called from client browser code)

---

## Nabu Verification Requirements

When Nabu receives an inbound request from Fenr:

1. **Extract Authorization Header**:
   Read `Authorization: Bearer <token>`. Match the `Bearer` authentication scheme case-insensitively; if the header is missing, uses another scheme, or has no token, reject with `401 Unauthorized`.
2. **Decode Header & Locate Key**:
   Inspect the JWT header for `alg: "EdDSA"` and the `kid` header parameter.
3. **Lookup Public Key**:
   Look up `kid` in local cached JWKS.
   - If `kid` is missing from cache, fetch fresh JWKS from Fenr (`GET /api/auth/jwks`).
   - If `kid` is still not found, reject with `401 Unauthorized` (key revoked or unknown).
4. **Verify Cryptographic Signature**:
   Verify the signature using the retrieved `Ed25519` public key.
5. **Validate Claims**:
   - `iss`: Must exactly match configured Fenr base URL (`BETTER_AUTH_URL`).
   - `aud`: Must match `"nabu"`.
   - `exp`: Current time must be before `exp` timestamp (allowing standard clock skew tolerance, e.g. 30s leeway).
   - `nbf` (if present): Current time must be after `nbf` (allowing standard clock skew tolerance, e.g. 30s leeway).
   - `activeOrganizationId`: Required tenant claim to scope database/ledger operations and prevent cross-tenant confused-deputy access.
6. **Key Rotation & Refresh**:
   Nabu must cache keys with a sensible TTL (e.g. 1 hour). When an unrecognized `kid` is received, Nabu may refresh eagerly from Fenr's JWKS endpoint using single-flight request coalescing and a cooldown period (e.g. 5–10s) to prevent cache stampedes against Fenr's JWKS endpoint.
