# VocalBridge Agent Gateway

A multi-tenant AI agent gateway with reliability features (timeouts, retries, fallback), usage metering & billing preview, and a minimal React dashboard.

## Tech Stack

- Backend
    - Node.js (16.x)
    - Express
    - SQLite
    - Jest (tests)

- Frontend
    - React (TypeScript)
    - Vite (v4 – Node 16 compatible)

**1. Run the Backend**

From the repo root:
- `npm install`
- `npm run db:reset`  # Reset DB
- `npm run db:seed`   # Seed DB
- `npm run dev`     # Start Server at http://localhost:3001

**2. Run the Frontend**

Open a new terminal:
- `cd apps/web`
- `npm install`
- `npm run dev`       # Frontend runs at http://127.0.0.1:5173

To Login paste one of the seeded tenant API keys

**3. Seed Data**
The seed script creates 2 tenants and 3 agents with different fallback configs.

**4. SAMPLE CURL COMMANDS**
- Create a Tenant:
    ```
    curl -X POST http://localhost:3001/tenants/create \
        -H "Content-Type: application/json" \
        -d '{"name":"Tenant A"}'
    ```

- List Agents:
    ```
    curl http://localhost:3001/agents \
        -H "x-api-key: YOUR_API_KEY"
    ```

- Create an agent:
    ```
    curl -X POST http://localhost:3001/agents \
     -H "x-api-key: YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
        "name": "Demo Bot",
        "primaryProvider": "vendorA",
        "fallbackProvider": "vendorB",
        "systemPrompt": "You are a helpful assistant."
    }'
    ```

- Update an agent:
    ```
    curl -X PUT http://localhost:3001/agents/AGENT_ID \
        -H "x-api-key: YOUR_API_KEY" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "Updated Agent"
        }'
    ```

- Create a conversation session:
    ```
    curl -X POST http://localhost:3001/gateway/sessions \
     -H "x-api-key: YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
        "agentId": "AGENT_ID_HERE",
        "customerId": "customer-123"
    }'
    ```

- Send a message:
    ```
    curl -X POST http://localhost:3001/gateway/sessions/SESSION_ID/messages \
     -H "x-api-key: YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
        "content": "Hello!",
        "idempotencyKey": "msg-001"
    }'
    ```

- Usage & billing rollup:
    ```
    curl "http://localhost:3001/billing/usage?from=2025-01-01&to=2025-12-31" \
     -H "x-api-key: YOUR_API_KEY"
    ```

**5. Tests**
- Run all tests (unit + integration):
    -  `npm test`
- Includes:
    - Retry & timeout unit tests
    - Pricing unit tests
    - Integration test: message → usage billed
    - Tenant isolation & idempotency tests


