
const express = require('express');
const { authTenant } = require('../middleware/authTenant');
const { getDb } = require('../db');
const { ulid } = require('ulid');

function agentsRoutes() {
    const r = express.Router();
    r.use(authTenant);

    r.get('/', async (req, res, next) => {
        try {
            const db = await getDb();
            const agents = await db.all('SELECT * FROM Agent WHERE tenantId = ? ORDER BY createdAt DESC', req.tenant.id);
            res.json({ agents });
        } catch (e) { next(e); }
    });

    r.post('/', async (req, res, next) => {
        try{
            const { name, primaryProvider, fallbackProvider, systemPrompt, enabledTools } = req.body || {};
            if (!name || !primaryProvider || !systemPrompt) {
                return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'name, primaryProvider, systemPrompt required' } });
            }
            if (fallbackProvider && fallbackProvider === primaryProvider) {
                return res.status(400).json({error: {code: 'BAD_REQUEST', message: 'Fallback provider must differ from primary provider' } });
            }

            const db = await getDb();
            const id = ulid();
            const now = new Date().toISOString();

            await db.run(
                `INSERT INTO Agent (id, tenantId, name, primaryProvider, fallbackProvider, systemPrompt, enabledToolsJson, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                id, req.tenant.id, name, primaryProvider, fallbackProvider || null, systemPrompt,
                JSON.stringify(Array.isArray(enabledTools) ? enabledTools: []),
                now, now
            );

            const agent = await db.get('SELECT * FROM Agent WHERE id = ? AND tenantId = ?', id, req.tenant.id);
            res.status(201).json({ agent }); 
        } catch (e) { next(e); }
    });

    r.put('/:id', async (req, res, next) => {
        try{
            const db = await getDb();
            const agentId = req.params.id;

            const existing = await db.get('SELECT * FROM Agent WHERE id = ? AND tenantId = ?', agentId, req.tenant.id);
            if (!existing) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Agent not found' } });

            const patch = req.body || {};
            const name = patch.name ?? existing.name;
            const primaryProvider = patch.primaryProvider ?? existing.primaryProvider;
            const fallbackProvider = patch.fallbackProvider ?? existing.fallbackProvider;
            const systemPrompt = patch.systemPrompt ?? existing.systemPrompt;
            const enabledToolsJson = JSON.stringify(Array.isArray(patch.enabledTools) ? patch.enabledTools : JSON.parse(existing.enabledToolsJson));

            const updatedAt = new Date().toISOString();

            await db.run(
                `UPDATE Agent SET name=?, primaryProvider=?, fallbackProvider=?, systemPrompt=?, enabledToolsJson=?, updatedAt=?
                WHERE id=? AND tenantId=?`,
                name, primaryProvider, fallbackProvider || null, systemPrompt, enabledToolsJson, updatedAt,
                agentId, req.tenant.id
            );

            const agent = await db.get('SELECT * FROM Agent WHERE id = ? AND tenantId = ?', agentId, req.tenant.id);
            res.json({ agent });
        } catch (e) { next(e); }
    });
    return r;
}

module.exports = { agentsRoutes };