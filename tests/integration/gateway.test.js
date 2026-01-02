
const request = require('supertest');
const fs = require('fs');

const { getDb, closeDb } = require('../../src/db');
const { createApp } = require('../../src/app');
const { tempDbPath, resetTestDb } = require('../testUtils');

describe('Integration: gateway message -> usage billed', () => {
  const app = createApp();
  const dbPath = tempDbPath('gateway.integration.sqlite');

  beforeAll(async () => {
    process.env.DATABASE_PATH = dbPath;
  });

  beforeEach(async () => {
    await resetTestDb(dbPath);
  });

  async function usageCount(tenantId) {
    const db = await getDb();
    const row = await db.get('SELECT COUNT(*) as c FROM UsageEvent WHERE tenantId = ?', tenantId);
    return row?.c || 0;
  }

  async function providerCallCount(tenantId) {
    const db = await getDb();
    const row = await db.get('SELECT COUNT(*) as c FROM ProviderCallEvent WHERE tenantId = ?', tenantId);
    return row?.c || 0;
  }

  it('creates usage event for a message and does NOT double bill on idempotency replay', async () => {
    // 1) Create tenant
    const tRes = await request(app)
      .post('/tenants/create')
      .send({ name: 'Tenant A' })
      .expect(200);

    const apiKey = tRes.body.apiKey;
    const tenantId = tRes.body.tenant.id;

    // 2) Create agent
    const aRes = await request(app)
      .post('/agents')
      .set('x-api-key', apiKey)
      .send({
        name: 'Agent 1',
        primaryProvider: 'vendorA',
        fallbackProvider: 'vendorB',
        systemPrompt: 'You are helpful.',
        enabledTools: ['InvoiceLookup']
      })
      .expect(201);

    const agentId = aRes.body.agent.id;

    // 3) Create session
    const sRes = await request(app)
      .post('/gateway/sessions')
      .set('x-api-key', apiKey)
      .send({ agentId, customerId: 'cust_1', metadata: { channel: 'chat' } })
      .expect(201);

    const sessionId = sRes.body.sessionId;

    const beforeUsage = await usageCount(tenantId);
    const beforeCalls = await providerCallCount(tenantId);

    // 4) Send message (first time)
    const idemKey = 'idem-123';
    const m1 = await request(app)
      .post(`/gateway/sessions/${sessionId}/messages`)
      .set('x-api-key', apiKey)
      .send({ content: 'Hello', idempotencyKey: idemKey })
      .expect(200);

    expect(m1.body).toHaveProperty('reply');
    expect(m1.body).toHaveProperty('provider');
    expect(m1.body).toHaveProperty('tokensIn');
    expect(m1.body).toHaveProperty('tokensOut');
    expect(m1.body).toHaveProperty('costUsd');
    expect(m1.body).toHaveProperty('assistantMessageId');

    const afterUsage1 = await usageCount(tenantId);
    const afterCalls1 = await providerCallCount(tenantId);

    // Must bill exactly once
    expect(afterUsage1).toBe(beforeUsage + 1);

    expect(afterCalls1).toBeGreaterThanOrEqual(beforeCalls + 1);

    // 5) Replay same message with same idempotencyKey (should NOT bill again)
    const m2 = await request(app)
      .post(`/gateway/sessions/${sessionId}/messages`)
      .set('x-api-key', apiKey)
      .send({ content: 'Hello', idempotencyKey: idemKey })
      .expect(200);

    const afterUsage2 = await usageCount(tenantId);

    expect(afterUsage2).toBe(afterUsage1); // no double charging
    expect(m2.body.assistantMessageId).toBe(m1.body.assistantMessageId);
    expect(m2.body.costUsd).toBe(m1.body.costUsd);
    expect(m2.body.provider).toBe(m1.body.provider);

    // 6) Transcript should include user + assistant messages (at least 2)
    const tr = await request(app)
      .get(`/gateway/sessions/${sessionId}`)
      .set('x-api-key', apiKey)
      .expect(200);

    expect(tr.body).toHaveProperty('messages');
    expect(tr.body.messages.length).toBeGreaterThanOrEqual(2);

    const roles = tr.body.messages.map((m) => m.role);
    expect(roles).toContain('user');
    expect(roles).toContain('assistant');
  });

  it('prevents cross-tenant access (tenant isolation)', async () => {
    // Tenant A
    const tA = await request(app).post('/tenants/create').send({ name: 'Tenant A' }).expect(200);
    const apiKeyA = tA.body.apiKey;

    // Tenant B
    const tB = await request(app).post('/tenants/create').send({ name: 'Tenant B' }).expect(200);
    const apiKeyB = tB.body.apiKey;

    // Create agent under tenant A
    const aRes = await request(app)
      .post('/agents')
      .set('x-api-key', apiKeyA)
      .send({
        name: 'A Agent',
        primaryProvider: 'vendorA',
        fallbackProvider: null,
        systemPrompt: 'You are helpful.'
      })
      .expect(201);

    const agentId = aRes.body.agent.id;

    // Create session under tenant A
    const sRes = await request(app)
      .post('/gateway/sessions')
      .set('x-api-key', apiKeyA)
      .send({ agentId, customerId: 'cust_x' })
      .expect(201);

    const sessionId = sRes.body.sessionId;

    // Tenant B tries to fetch tenant A session => 404
    await request(app)
      .get(`/gateway/sessions/${sessionId}`)
      .set('x-api-key', apiKeyB)
      .expect(404);

    // Tenant B tries to send message => 404 (SESSION_NOT_FOUND)
    const r = await request(app)
      .post(`/gateway/sessions/${sessionId}/messages`)
      .set('x-api-key', apiKeyB)
      .send({ content: 'hi', idempotencyKey: 'x-tenant' });

    expect([404, 401]).toContain(r.status);
  });

  it('enforces idempotency conflict (same key, different payload => 409)', async () => {
    const tRes = await request(app).post('/tenants/create').send({ name: 'Tenant A' }).expect(200);
    const apiKey = tRes.body.apiKey;

    const aRes = await request(app)
      .post('/agents')
      .set('x-api-key', apiKey)
      .send({
        name: 'Agent 1',
        primaryProvider: 'vendorA',
        fallbackProvider: 'vendorB',
        systemPrompt: 'You are helpful.'
      })
      .expect(201);

    const agentId = aRes.body.agent.id;

    const sRes = await request(app)
      .post('/gateway/sessions')
      .set('x-api-key', apiKey)
      .send({ agentId, customerId: 'cust_1' })
      .expect(201);

    const sessionId = sRes.body.sessionId;

    const idemKey = 'idem-same-key';

    // First request
    await request(app)
      .post(`/gateway/sessions/${sessionId}/messages`)
      .set('x-api-key', apiKey)
      .send({ content: 'hello', idempotencyKey: idemKey })
      .expect(200);

    // Second request with same idempotencyKey but different content => 409
    await request(app)
      .post(`/gateway/sessions/${sessionId}/messages`)
      .set('x-api-key', apiKey)
      .send({ content: 'DIFFERENT', idempotencyKey: idemKey })
      .expect(409);
  });
});
