# Overview
This repository implements a multi-tenant Agent Gateway: a backend service that lets each tenant create and manage AI agents (bots), run conversations through vendor-agnostic providers (mock VendorA/VendorB), and records provider events + usage/cost events for analytics and billing preview. A minimal React dashboard provides agent management, chat, and usage views.

## Key goals:
- Strong tenant isolation (no cross-tenant data access)
- Clean provider adapter abstraction (easy to add vendors)
- Reliability features: timeouts, retries, fallback
- Correctness: idempotency to prevent double-writes/double-billing

## High-Level Design

### Components
1. React Dashboard (UI)
- “Login” via API key 
- Agent CRUD (list/create/update/delete)
- “Try it” chat UI (create session, send messages)
- Usage/analytics tables (totals, by provider, top agents)

2. Agent Gateway API (Express)
Core modules:
- Middleware
    - requestId: attach a correlation ID to each request 
    - authTenant: API key authentication + tenant scoping
    - error: structured error responses 
- Routes
    - /tenants/* tenant provisioning (create tenant + API key)
    - /agents/* agent CRUD
    - /gateway/* conversation/session APIs (vendor-agnostic)
    - /billing/* usage rollups for analytics
    - /health liveness check
- Services
    - gateway.service: orchestration of session/message flow
    - vendors/*: provider adapters (VendorA, VendorB)
    - retry, timeout: reliability primitives
    - usage.service: compute + persist cost and usage events

3. SQLite Database
Stores:
- Tenants (hashed API keys)
- Agents (per-tenant config)
- Sessions + Messages (transcript)
- ProviderCallEvent (debugging, reliability visibility)
- UsageEvent (tokens, cost)
- IdempotencyKey (replay safety)

### Tenancy Isolation
**Authentication**
- Each request (except tenant creation) must include: 
    - x-api-key: <tenantApiKey>
- API keys are stored hashed (e.g., SHA-256) in DB, never stored in plaintext.
- `authTenant` middleware:
    - Reads `x-api-key`
    - Hashes the key
    - Looks up tenant by apiKeyHash
    - Attaches req.tenant = { id, name }

**Data access rules**
- The client never sends tenantId in request bodies.
- Every DB read/write includes tenantId = req.tenant.id.
- Any attempt to access another tenant’s resource results in 404/403-style behavior.
- Examples
    - Fetch agent:
        - `SELECT * FROM Agent WHERE id=? AND tenantId=?`
    - Fetch session:
        - `SELECT * FROM Session WHERE id=? AND tenantId=?`
- This guarantees no cross-tenant access even if an attacker guesses IDs.

**Failure Handling and Reliability**
Structured errors
- No stack traces returned to client.
- Error shape:
    - status (HTTP)
    - code
    - message 

Vendor call reliability
For each provider call:
- Timeout enforced (per-vendor)
- Retries on transient errors:
    - HTTP 500
    - HTTP 429 
    - timeouts
- Fallback to secondary provider when configured
- If primary fails after retries, attempt fallback 

Provider call tracing
- Each attempt records a ProviderCallEvent:
    - provider name
    - status (success/failure)
    - latencyMs
    - errorCode (if any)
    - requestId/correlationId

## Low-Level Design

### Database Schema

**Tenant**
- id (TEXT, ULID/UUID)
- name (TEXT)
- apiKeyHash (TEXT)
- createdAt (TEXT ISO)
Purpose: tenant identity + secure API key verification.

**Agent**
- id
- tenantId
- name
- primaryProvider (vendorA | vendorB)
- fallbackProvider (nullable)
- systemPrompt (TEXT)
- enabledToolsJson (nullable TEXT JSON)
- createdAt
Purpose: per-tenant bot configuration and extensibility (tools).

**Session**
- id
- tenantId
- agentId
- customerId
- metadataJson
- createdAt
Purpose: conversation container for a tenant+agent+customer.

**Message**
- id
- tenantId
- sessionId
- role (user | assistant)
- content
- createdAt
Purpose: full transcript.

**ProviderCallEvent**
- id
- tenantId
- sessionId
- agentId
- provider
- status
- latencyMs
- errorCode (nullable)
- requestId (nullable)
- createdAt
Purpose: reliability visibility (timeouts/retries/fallback).

**UsageEvent**
- id
- tenantId
- sessionId
- agentId
- provider
- tokensIn
- tokensOut
- costUsd
- createdAt
Purpose: billing source of truth for rollups.

**IdempotencyKey**
- id
- tenantId
- key
- requestHash
- responseJson
- createdAt
- Unique constraint (tenantId, key)
Purpose: safe retries without double-writing/double-billing.

### Provider Adapter Interface

**Design intent**
Normalize vendor differences behind a single interface so adding a new vendor only requires implementing one adapter.

Interface (conceptual)
`providers.generateReply({ systemPrompt, messages, timeoutMs, requestId }) -> { outputText, tokensIn, tokensOut, latencyMs, raw }`

VendorA adapter (mock)
- Returns:
    - `outputText`, `tokensIn`, `tokensOut`, `latencyMs`
- Failure behavior:
    - ~10% HTTP 500
    - random slow responses (simulated latency)

VendorB adapter (mock)
- Returns:
    - `choices[0].message.content`
    - `usage.input_tokens, usage.output_tokens`
- Failure behavior:
    - can return HTTP 429 with `retryAfterMs`
Adapters map vendor responses into the unified shape used by the gateway.

### Retry / Timeout / Fallback Logic

**Timeout**
- Implemented via a wrapper that races the vendor promise vs a timer
- On timeout:
    - throw error { code: 'TIMEOUT' }
    - treated as transient (retryable)

**Retry**
- Retries only on transient failures:
    - HTTP 500
    - HTTP 429
    - TIMEOUT

**Fallback**
Flow for a message:
1. Try primary provider with timeout + retries
2. If still failing and fallbackProvider configured:
    - try fallback provider with its own timeout + retries
3. If both fail:
    - return structured 502/500 error
ProviderCallEvent rows are written for attempts, so fallback behavior is observable.

### Idempotency Approach

**Goal**
Prevent double-writes (duplicate messages) and double-charging (duplicate usage events) when a client retries.

**Mechanism**
- Client sends `idempotencyKey` with message request.
- Server computes `requestHash = sha256(payloadNormalized)`.
- Server checks `IdempotencyKey(tenantId, key)`:
    - If not found:
        - execute request
        - store `responseJson` with requestHash
        - return response
    - If found and `requestHash` matches:
        - return stored `responseJson` (no new messages/usage events)
    - If found and `requestHash` differs:
        - return 409 `IDEMPOTENCY_CONFLICT`
This ensures safe retries and prevents accidental double-billing.

### Usage Metering & Billing Preview

**Usage event creation**
For each assistant response:
- tokensIn/out computed from provider response
- cost computed using a fixed pricing table:
    - vendorA: $0.002 / 1K tokens
    - vendorB: $0.003 / 1K tokens
- persist `UsageEvent(tenantId, agentId, sessionId, provider, tokensIn, tokensOut, costUsd)`

**Rollups**
Billing endpoint returns:
- Totals: sessions, tokens, cost
- Breakdown by provider
- Top agents by cost

SQLite aggregations use UsageEvent as the source of truth:
- `SUM(tokensIn + tokensOut)`
- `COUNT(DISTINCT sessionId)`
- `SUM(costUsd)`

