const { ulid } = require('ulid');
const { getDb } = require('./index');

async function getAgentForTenant(tenantId, agentId) {
  const db = await getDb();
  return db.get('SELECT * FROM Agent WHERE id = ? AND tenantId = ?', agentId, tenantId);
}

async function getSessionForTenant(tenantId, sessionId) {
  const db = await getDb();
  return db.get('SELECT * FROM Session WHERE id = ? AND tenantId = ?', sessionId, tenantId);
}

async function listMessagesForSession(tenantId, sessionId) {
  const db = await getDb();
  return db.all(
    'SELECT id, role, content, createdAt FROM Message WHERE tenantId = ? AND sessionId = ? ORDER BY createdAt ASC',
    tenantId, sessionId
  );
}

async function createSession({ tenantId, agentId, customerId, metadataJson }) {
  const db = await getDb();
  const id = ulid();
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO Session (id, tenantId, agentId, customerId, createdAt, metadataJson)
     VALUES (?, ?, ?, ?, ?, ?)`,
    id, tenantId, agentId, customerId, now, JSON.stringify(metadataJson || {})
  );
  return { id, createdAt: now };
}

async function createMessage({ tenantId, sessionId, role, content }) {
  const db = await getDb();
  const id = ulid();
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO Message (id, tenantId, sessionId, role, content, createdAt)
     VALUES (?, ?, ?, ?, ?, ?)`,
    id, tenantId, sessionId, role, content, now
  );
  return { id, createdAt: now };
}

module.exports = {
  getAgentForTenant,
  getSessionForTenant,
  listMessagesForSession,
  createSession,
  createMessage
};