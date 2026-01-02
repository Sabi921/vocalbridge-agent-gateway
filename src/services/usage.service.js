
const {computeCostUsd } = require('../utils/pricing');
const { getDb } = require('../db');
const { ulid } = require('ulid');

async function recordUsage({ tenantId, sessionId, agentId, provider, tokensIn, tokensOut, createdAt }) {
    const db = await getDb();
    const costUsd = computeCostUsd(provider, tokensIn, tokensOut);
    const id = ulid();

    await db.run(
        `INSERT INTO UsageEvent (id, tenantId, sessionId, agentId, provider, tokensIn, tokensOut, costUsd, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id, tenantId, sessionId, agentId, provider, tokensIn, tokensOut, costUsd, createdAt
    );

    return { id, costUsd };
}

module.exports = { recordUsage };