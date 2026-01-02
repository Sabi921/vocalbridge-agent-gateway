
const express = require('express');
const { authTenant } = require('../middleware/authTenant');
const { createSession, getSessionForTenant, listMessagesForSession, getAgentForTenant } = require('../db/queries');
const { sendMessage } = require('../services/gateway.service');

function gatewayRoutes() {
    const r = express.Router();
    r.use(authTenant);

    // Create Session
    r.post('/sessions', async (req, res, next) => {
        try {
            const { agentId, customerId, metadata } = req.body || {};
            if (!agentId || !customerId) {
                return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'agentId and customerId required' } });
            } 

            const agent = await getAgentForTenant(req.tenant.id, agentId);
            if (!agent) return res.status(404).json({error: {code: 'NOT_FOUND', message: 'Agent not found' } });

            const s = await createSession({ tenantId: req.tenant.id, agentId, customerId, metadataJson: metadata || {} });
            res.status(201).json({ sessionId: s.id });
        } catch (e) { next(e); }
    });

    // Send Message
    r.post('/sessions/:id/messages', async (req, res, next) => {
        try {
            const sessionId = req.params.id;
            const content = req.body?.content;
            const idempotencyKey = req.body?.idempotencyKey || req.header('x-idempotency-key');

            if (!content) return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'content required' } });

            const response = await sendMessage({
                tenant: req.tenant,
                sessionId,
                content,
                idempotencyKey,
                requestId: req.requestId
            });

            res.json(response);
        } catch (e) { next(e); }
    });

    r.get('/sessions/:id', async (req, res, next) => {
        try{
            const sessionId = req.params.id;
            const session = await getSessionForTenant(req.tenant.id, sessionId);
            if (!session) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Session not found' } });

            const messages = await listMessagesForSession(req.tenant.id, sessionId);
            res.json({ session, messages });
        } catch (e) { next(e); }
    });

    return r;
}

module.exports = { gatewayRoutes };