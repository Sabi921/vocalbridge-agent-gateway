// scripts/seed.js
//
// Seeds: 2 tenants + 3 agents (with different primary/fallback configs)
//
// Run:
//   npm run db:migrate
//   npm run db:seed
//

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { ulid } = require("ulid");

const { env } = require("../src/config/env");
const { getDb } = require("../src/db");
const { sha256Hex } = require("../src/utils/crypto");
const { sendMessage } = require("../src/services/gateway.service");

const ROOT = path.join(__dirname, "..");
const INIT_SQL_PATH = path.join(ROOT, "sql", "001_init.sql");

function randomApiKey() {
  return crypto.randomBytes(24).toString("hex");
}

function isoNow() {
  return new Date().toISOString();
}

async function ensureDbFileDir() {
  const dbPath = env.DATABASE_PATH;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

async function migrate() {
  const db = await getDb();
  const sql = fs.readFileSync(INIT_SQL_PATH, "utf-8");
  await db.exec(sql);
}

async function wipeAll(db) {
  await db.exec("PRAGMA foreign_keys = OFF;");
  await db.exec("DELETE FROM IdempotencyKey;");
  await db.exec("DELETE FROM ProviderCallEvent;");
  await db.exec("DELETE FROM UsageEvent;");
  await db.exec("DELETE FROM Message;");
  await db.exec("DELETE FROM Session;");
  await db.exec("DELETE FROM Agent;");
  await db.exec("DELETE FROM Tenant;");
  await db.exec("PRAGMA foreign_keys = ON;");
}

async function insertTenant(db, { name }) {
  const tenantId = ulid();
  const apiKey = randomApiKey();
  const apiKeyHash = sha256Hex(apiKey);
  const createdAt = isoNow();

  await db.run(
    "INSERT INTO Tenant (id, name, apiKeyHash, createdAt) VALUES (?, ?, ?, ?)",
    tenantId,
    name,
    apiKeyHash,
    createdAt
  );

  return { id: tenantId, name, apiKey, apiKeyHash, createdAt };
}

async function insertAgent(db, tenantId, agent) {
  const id = ulid();
  const now = isoNow();
  await db.run(
    `INSERT INTO Agent
     (id, tenantId, name, primaryProvider, fallbackProvider, systemPrompt, enabledToolsJson, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    tenantId,
    agent.name,
    agent.primaryProvider,
    agent.fallbackProvider || null,
    agent.systemPrompt,
    JSON.stringify(agent.enabledTools || []),
    now,
    now
  );
  return { id, ...agent, tenantId };
}

async function insertSession(db, tenantId, { agentId, customerId, metadata }) {
  const id = ulid();
  const createdAt = isoNow();
  await db.run(
    `INSERT INTO Session (id, tenantId, agentId, customerId, createdAt, metadataJson)
     VALUES (?, ?, ?, ?, ?, ?)`,
    id,
    tenantId,
    agentId,
    customerId,
    createdAt,
    JSON.stringify(metadata || {})
  );
  return { id, tenantId, agentId, customerId, createdAt, metadataJson: JSON.stringify(metadata || {}) };
}

async function countUsageEvents(db, tenantId) {
  const row = await db.get("SELECT COUNT(*) as c FROM UsageEvent WHERE tenantId = ?", tenantId);
  return row?.c || 0;
}

async function countProviderErrors(db, tenantId) {
  const row = await db.get(
    `SELECT COUNT(*) as c
     FROM ProviderCallEvent
     WHERE tenantId = ? AND status = 'error'`,
    tenantId
  );
  return row?.c || 0;
}

async function countProviderErrorByCode(db, tenantId, errorCode) {
  const row = await db.get(
    `SELECT COUNT(*) as c
     FROM ProviderCallEvent
     WHERE tenantId = ? AND status = 'error' AND errorCode = ?`,
    tenantId,
    errorCode
  );
  return row?.c || 0;
}

async function listTranscript(db, tenantId, sessionId) {
  return db.all(
    `SELECT role, content, createdAt
     FROM Message
     WHERE tenantId = ? AND sessionId = ?
     ORDER BY createdAt ASC`,
    tenantId,
    sessionId
  );
}

async function tryProduceFallbackOrErrors({
  tenant,
  sessionId,
  label,
  maxTries = 30,
  targetFallback = true,
}) {
  const db = await getDb();

  let sawFallback = false;
  let beforeErrs = await countProviderErrors(db, tenant.id);

  for (let i = 1; i <= maxTries; i++) {
    const idempotencyKey = `${label}-${i}-${ulid()}`;
    const requestId = `${label}-${i}-${ulid()}`;
    const content = `Seed message [${label}] attempt ${i}`;

    try {
      const resp = await sendMessage({
        tenant,
        sessionId,
        content,
        idempotencyKey,
        requestId,
      });

      if (resp.fallbackUsed) sawFallback = true;

      const afterErrs = await countProviderErrors(db, tenant.id);
      const producedErr = afterErrs > beforeErrs;
      beforeErrs = afterErrs;

      if ((targetFallback && sawFallback) || (!targetFallback && producedErr)) {
        return { ok: true, sawFallback, tries: i };
      }
    } catch (e) {
      // Even failures should record ProviderCallEvent (from gateway.service).
      // Keep trying to generate events.
    }
  }

  return { ok: false, sawFallback, tries: maxTries };
}

async function testIdempotencyReplay({ tenant, sessionId }) {
  const db = await getDb();

  const before = await countUsageEvents(db, tenant.id);

  const idempotencyKey = `idem-replay-${ulid()}`;
  const requestId1 = `idem-req1-${ulid()}`;
  const requestId2 = `idem-req2-${ulid()}`;
  const content = "Idempotency replay test message";

  const r1 = await sendMessage({
    tenant,
    sessionId,
    content,
    idempotencyKey,
    requestId: requestId1,
  });

  const mid = await countUsageEvents(db, tenant.id);

  const r2 = await sendMessage({
    tenant,
    sessionId,
    content,
    idempotencyKey,
    requestId: requestId2,
  });

  const after = await countUsageEvents(db, tenant.id);

  // Expectations:
  // usage increments exactly once
  // replay returns same response 
  const okUsage = mid === before + 1 && after === mid;
  const okSame =
    r2.assistantMessageId === r1.assistantMessageId &&
    r2.costUsd === r1.costUsd &&
    r2.provider === r1.provider;

  return { okUsage, okSame, r1, r2, before, mid, after };
}

async function testIdempotencyConflict({ tenant, sessionId }) {
  const idempotencyKey = `idem-conflict-${ulid()}`;
  const content1 = "Idempotency conflict content A";
  const content2 = "Idempotency conflict content B (different)";

  // First should succeed
  await sendMessage({
    tenant,
    sessionId,
    content: content1,
    idempotencyKey,
    requestId: `idem-c1-${ulid()}`,
  });

  // Second with same key but different content should 409
  try {
    await sendMessage({
      tenant,
      sessionId,
      content: content2,
      idempotencyKey,
      requestId: `idem-c2-${ulid()}`,
    });
    return { ok: false, message: "Expected conflict but request succeeded" };
  } catch (e) {
    const status = e.status || e.httpStatus || 500;
    const code = e.code || "UNKNOWN";
    return { ok: status === 409 && code === "IDEMPOTENCY_CONFLICT", status, code };
  }
}

async function testCrossTenantIsolation({ tenantA, tenantB, sessionIdA }) {
  try {
    await sendMessage({
      tenant: tenantB,
      sessionId: sessionIdA,
      content: "Cross-tenant access attempt",
      idempotencyKey: `x-tenant-${ulid()}`,
      requestId: `x-tenant-${ulid()}`,
    });
    return { ok: false, message: "Expected tenant isolation failure but succeeded" };
  } catch (e) {
    // gateway.service checks Session scoped by tenant, so should be SESSION_NOT_FOUND
    const status = e.status || 500;
    const code = e.code || "UNKNOWN";
    return { ok: status === 404 && code === "SESSION_NOT_FOUND", status, code };
  }
}

async function main() {
  console.log("Seeding DB and generating demo data...");
  console.log(`DB: ${env.DATABASE_PATH}`);

  await ensureDbFileDir();
  await migrate();

  const db = await getDb();
  await wipeAll(db);

  // 1) Seed tenants
  const tenantA = await insertTenant(db, { name: "Acme Health" });
  const tenantB = await insertTenant(db, { name: "Bright Billing Co" });

  // 2) Seed agents (>= 3, with different configs) 
  // Agent1: vendorA primary, vendorB fallback (demonstrate fallback)
  const agentA1 = await insertAgent(db, tenantA.id, {
    name: "RCM Helper (A->B fallback)",
    primaryProvider: "vendorA",
    fallbackProvider: "vendorB",
    systemPrompt:
      "You are a friendly revenue-cycle assistant. Be concise, clarify billing terms, and ask one follow-up question if needed.",
    enabledTools: ["InvoiceLookup"],
  });

  // Agent2: vendorB primary, no fallback (demonstrate rate limiting + retries potentially)
  const agentA2 = await insertAgent(db, tenantA.id, {
    name: "Policy Explainer (B only)",
    primaryProvider: "vendorB",
    fallbackProvider: null,
    systemPrompt:
      "You explain healthcare billing policies in simple language. Provide bullet points and avoid jargon.",
    enabledTools: [],
  });

  // Agent3: tenantB agent, vendorB primary, vendorA fallback
  const agentB1 = await insertAgent(db, tenantB.id, {
    name: "Payments Concierge (B->A fallback)",
    primaryProvider: "vendorB",
    fallbackProvider: "vendorA",
    systemPrompt:
      "You help users understand invoices and payments. Be polite and confirm key details before suggesting actions.",
    enabledTools: ["InvoiceLookup", "PaymentStatus"],
  });

  // 3) Seed sessions 
  const sessionA1 = await insertSession(db, tenantA.id, {
    agentId: agentA1.id,
    customerId: "cust_1001",
    metadata: { channel: "chat", locale: "en-US" },
  });

  const sessionA2 = await insertSession(db, tenantA.id, {
    agentId: agentA2.id,
    customerId: "cust_1002",
    metadata: { channel: "chat", locale: "en-US" },
  });

  const sessionB1 = await insertSession(db, tenantB.id, {
    agentId: agentB1.id,
    customerId: "cust_2001",
    metadata: { channel: "chat", locale: "en-US" },
  });

  // 4) gateway: message -> usage billed 
  console.log("Generating messages & usage events...");

  // A) Basic success messages
  await sendMessage({
    tenant: tenantA,
    sessionId: sessionA1.id,
    content: "Hi, can you explain why my bill increased this month?",
    idempotencyKey: `basic-a1-${ulid()}`,
    requestId: `basic-a1-${ulid()}`,
  });

  await sendMessage({
    tenant: tenantA,
    sessionId: sessionA2.id,
    content: "What does deductible mean in simple terms?",
    idempotencyKey: `basic-a2-${ulid()}`,
    requestId: `basic-a2-${ulid()}`,
  });

  await sendMessage({
    tenant: tenantB,
    sessionId: sessionB1.id,
    content: "I made a payment yesterday, can you confirm if it went through?",
    idempotencyKey: `basic-b1-${ulid()}`,
    requestId: `basic-b1-${ulid()}`,
  });

  // B) Attempts to produce fallback or provider errors 
  const fallbackTry = await tryProduceFallbackOrErrors({
    tenant: tenantA,
    sessionId: sessionA1.id,
    label: "fallback-a1",
    maxTries: 40,
    targetFallback: true,
  });

  const errTry = await tryProduceFallbackOrErrors({
    tenant: tenantA,
    sessionId: sessionA2.id,
    label: "error-a2",
    maxTries: 40,
    targetFallback: false,
  });

  // C) Idempotency replay (no double usage) + conflict
  const idemReplay = await testIdempotencyReplay({ tenant: tenantA, sessionId: sessionA1.id });
  const idemConflict = await testIdempotencyConflict({ tenant: tenantA, sessionId: sessionA1.id });

  // D) Cross-tenant isolation (tenantB cannot access tenantA session)
  const isolation = await testCrossTenantIsolation({
    tenantA,
    tenantB,
    sessionIdA: sessionA1.id,
  });

  // 5) Print summary
  const usageCountA = await countUsageEvents(db, tenantA.id);
  const usageCountB = await countUsageEvents(db, tenantB.id);

  const errCountA = await countProviderErrors(db, tenantA.id);
  const err429A = await countProviderErrorByCode(db, tenantA.id, "HTTP_429");
  const err500A = await countProviderErrorByCode(db, tenantA.id, "HTTP_500");
  const errTimeoutA = await countProviderErrorByCode(db, tenantA.id, "TIMEOUT");

  const transcriptA1 = await listTranscript(db, tenantA.id, sessionA1.id);

  console.log("\n Seed complete.\n");

  console.log("=== TENANTS (API keys) ===");
  console.log(`Tenant A: ${tenantA.name}`);
  console.log(`  tenantId: ${tenantA.id}`);
  console.log(`  apiKey:   ${tenantA.apiKey}`);
  console.log(`Tenant B: ${tenantB.name}`);
  console.log(`  tenantId: ${tenantB.id}`);
  console.log(`  apiKey:   ${tenantB.apiKey}`);

  console.log("\n=== AGENTS ===");
  console.log(`Tenant A Agent 1: ${agentA1.name} (primary=${agentA1.primaryProvider}, fallback=${agentA1.fallbackProvider})`);
  console.log(`  agentId: ${agentA1.id}`);
  console.log(`Tenant A Agent 2: ${agentA2.name} (primary=${agentA2.primaryProvider}, fallback=${agentA2.fallbackProvider || "none"})`);
  console.log(`  agentId: ${agentA2.id}`);
  console.log(`Tenant B Agent 1: ${agentB1.name} (primary=${agentB1.primaryProvider}, fallback=${agentB1.fallbackProvider})`);
  console.log(`  agentId: ${agentB1.id}`);

  console.log("\n=== SESSIONS ===");
  console.log(`Session A1: ${sessionA1.id} (tenantA, agentA1, customerId=${sessionA1.customerId})`);
  console.log(`Session A2: ${sessionA2.id} (tenantA, agentA2, customerId=${sessionA2.customerId})`);
  console.log(`Session B1: ${sessionB1.id} (tenantB, agentB1, customerId=${sessionB1.customerId})`);

  console.log("\n=== GENERATED DATA CHECKS ===");
  console.log(`Usage events created: tenantA=${usageCountA}, tenantB=${usageCountB}`);
  console.log(`Provider error events (tenantA): total=${errCountA} (429=${err429A}, 500=${err500A}, timeout=${errTimeoutA})`);
  console.log(`Fallback attempt (tenantA agentA1): ok=${fallbackTry.ok}, sawFallback=${fallbackTry.sawFallback}, tries=${fallbackTry.tries}`);
  console.log(`Error-generation attempt (tenantA agentA2): ok=${errTry.ok}, tries=${errTry.tries}`);
  console.log(`Idempotency replay: okUsage=${idemReplay.okUsage}, okSameResponse=${idemReplay.okSame}`);
  console.log(`Idempotency conflict: ok=${idemConflict.ok}, status=${idemConflict.status}, code=${idemConflict.code}`);
  console.log(`Cross-tenant isolation: ok=${isolation.ok}, status=${isolation.status}, code=${isolation.code}`);

  console.log("\n=== SAMPLE TRANSCRIPT (TenantA SessionA1) ===");
  for (const m of transcriptA1.slice(0, 8)) {
    console.log(`- [${m.role}] ${m.content}`);
  }
  if (transcriptA1.length > 8) console.log(`... (${transcriptA1.length} messages total)`);
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
