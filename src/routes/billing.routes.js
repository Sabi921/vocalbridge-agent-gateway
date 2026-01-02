
const express = require('express');
const { authTenant } = require('../middleware/authTenant');
const { getDb } = require('../db');

function billingRoutes() {
    const r = express.Router();
    r.use(authTenant);

    // Get billing usage
    r.get('/usage', async (req, res, next) => {
        try {
            const { from, to } = req.query;
            if (!from || !to) return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'from and to required' } });

            const db = await getDb();
            const tenantId = req.tenant.id;
            
            const totals = await db.get(
                `SELECT
                    COUNT(DISTINCT sessionId) as sessions,
                    SUM(tokensIn + tokensOut) as tokens,
                    SUM(costUsd) as costUsd
                 FROM UsageEvent
                 WHERE tenantId = ? AND createdAt >= ? AND createdAt <= ?`,
                tenantId, `${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`
            );
            
            const byProvider = await db.all(
                `SELECT provider,
                    COUNT(DISTINCT sessionId) as sessions,
                    SUM(tokensIn) as tokensIn,
                    SUM(tokensOut) as tokensOut,
                    SUM(tokensIn + tokensOut) as tokens,
                    SUM(costUsd) as costUsd
                FROM UsageEvent
                WHERE tenantId = ?
                AND createdAt >= ?
                AND createdAt <= ?
                GROUP BY provider
                ORDER BY costUsd DESC`,
                tenantId, `${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`
            );

            const topAgents = await db.all(
                `SELECT a.id as agentId,
                    a.name as agentName,
                    COUNT(DISTINCT u.sessionId) as sessions,
                    SUM(u.tokensIn + u.tokensOut) as tokens,
                    SUM(u.costUsd) as costUsd
                FROM UsageEvent u
                JOIN Agent a ON a.id = u.agentId
                WHERE u.tenantId = ?
                AND u.createdAt >= ?
                AND u.createdAt <= ?
                GROUP BY a.id, a.name
                ORDER BY costUsd DESC
                LIMIT 10`,
                tenantId, `${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`
            );

            res.json({
                range: { from, to },
                totals: {
                    sessions: totals.sessions || 0,
                    tokens: totals.tokens || 0,
                    costUsd: totals.costUsd || 0
                },
                byProvider,
                topAgents
            });
        } catch (e) { next(e); }
    });

    return r;
}

module.exports = { billingRoutes }; 