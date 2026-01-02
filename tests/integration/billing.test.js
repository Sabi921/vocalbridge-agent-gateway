
const request = require('supertest');

const { createApp } = require('../../src/app');
const { tempDbPath, resetTestDb } = require('../testUtils');

describe('Integration: billing usage rollups', () => {
  const app = createApp();
  const dbPath = tempDbPath('billing.integration.sqlite');

  beforeAll(() => {
    process.env.DATABASE_PATH = dbPath;
  });

  beforeEach(async () => {
    await resetTestDb(dbPath);
  });

  it('returns totals, provider breakdown, and top agents', async () => {
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

    // Create at least one usage event
    await request(app)
      .post(`/gateway/sessions/${sessionId}/messages`)
      .set('x-api-key', apiKey)
      .send({ content: 'hello', idempotencyKey: 'idem-1' })
      .expect(200);

    const from = '2026-01-01';
    const to = '2026-12-31';

    const uRes = await request(app)
      .get(`/billing/usage?from=${from}&to=${to}`)
      .set('x-api-key', apiKey)
      .expect(200);

    expect(uRes.body).toHaveProperty('totals');
    expect(uRes.body.totals.sessions).toBeGreaterThanOrEqual(1);
    expect(uRes.body.totals.tokens).toBeGreaterThanOrEqual(1);
    expect(uRes.body.totals.costUsd).toBeGreaterThanOrEqual(0);

    expect(Array.isArray(uRes.body.byProvider)).toBe(true);
    expect(Array.isArray(uRes.body.topAgents)).toBe(true);

    // Should include our agent in top agents
    const agentRow = uRes.body.topAgents.find((x) => x.agentId === agentId);
    expect(agentRow).toBeTruthy();
    expect(agentRow.costUsd).toBeGreaterThanOrEqual(0);
  });
});
