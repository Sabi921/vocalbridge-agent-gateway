
const { env } = require('../config/env');
const { getDb } = require('../db');
const { stableJsonHash } = require('../utils/crypto');
const { getAdapter } = require('./vendors');
const { withTimeout } = require('./timeout');
const { withRetry } = require('./retry');
const { recordUsage } = require('./usage.service');
const { createMessage, listMessagesForSession, getAgentForTenant, getSessionForTenant } = require('../db/queries');
const { ulid } = require('ulid');

async function logProviderCall({ tenantId, sessionId, agentId, provider, status, latencyMs, errorCode, requestId }) {
    const db = await getDb();
    const id = ulid();
    const createdAt = new Date().toISOString();
    await db.run(
        `INSERT INTO ProviderCallEvent (id, tenantId, sessionId, agentId, provider, status, latencyMs, errorCode, requestId, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id, tenantId, sessionId, agentId, provider, status, latencyMs, errorCode || null, requestId, createdAt
    );
}

async function getIdempotentResponse(tenantId, key) {
    const db = await getDb();
    return db.get('SELECT * FROM IdempotencyKey WHERE tenantId = ? AND key = ?', tenantId, key);
}

async function storeIdempotentResponse({ tenantId, key, requestHash, responseObj }) {
    const db = await getDb();
    const id = ulid();
    const createdAt = new Date(). toISOString();
    await db.run(
        `INSERT INTO IdempotencyKey (id, tenantId, key, requestHash, responseJson, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)`,
        id, tenantId, key, requestHash, JSON.stringify(responseObj), createdAt
    );
}

async function callProviderWithReliability({ provider, messages, tenantId, sessionId, agentId, requestId }) {
    const adapter = getAdapter(provider);

    const start = Date.now();

    try {
        const result = await withRetry(async () => {
            const p = adapter.chat({ messages });
            return withTimeout(p, env.VENDOR_TIMEOUT_MS);
        });

        const latencyMs = Date.now() - start;
        await logProviderCall({ tenantId, sessionId, agentId, provider, status: 'ok', latencyMs, requestId });
        return { ...result, providerUsed: provider, latencyMs }; 
    } catch (err) {
        const latencyMs = Date.now() - start;
        const errorcode = err.code || (err.httpStatus ? `HTTP_${err.httpStatus}` : 'ERROR');
        await logProviderCall({ tenantId, sessionId, agentId, provider, status: 'error', latencyMs, errorCode, requestId });
        throw err;
    }
}

async function sendMessage({ tenant, sessionId, content, idempotencyKey, requestId }) {
    if (!idempotencyKey) {
        const err = new Error('Missing Idempotency key');
        err.status = 400;
        err.code = 'MISSING_IDEMPOTENCY_KEY';
        throw err;
    }

    const session = await getSessionForTenant(tenant.id, sessionId);
    if (!session) {
        const err = new Error('Session not found');
        err.status = 404;
        err.code = 'SESSION_NOT_FOUND';
        throw err;
    }

    const agent = await getAgentForTenant(tenant.id, session.agentId);
    if (!agent) {
        const err = new Error('Agent not found');
        err.status = 404;
        err.code = 'AGENT_NOT_FOUND';
        throw err;
    }

    // Check for Idempotency
    const requestHash = stableJsonHash({ sessionId, agentId: agent.id, content });
    const existing = await getIdempotentResponse(tenant.id, idempotencyKey);
    if (existing) {
        if (existing.requestHash !== requestHash){
            const err = new Error('Idempotency key reuse with different payload');
            err.status = 409;
            err.code = 'IDEMPOTENCY_CONFLICT';
            throw err;
        }
        return JSON.parse(existing.responseJson);
    }

    // Write user message
    await createMessage({ tenantId: tenant.id, sessionId, role: 'user', content });

    // Build conversation context
    const transcript = await listMessagesForSession(tenant.id, sessionId);
    const messagesForModel = [
        { role: 'system', content: agent.systemPrompt },
        ...transcript.map(m => ({ role: m.role, content: m.content }))
    ];

    // fallback
    let modelResult;
    let fallbackUsed = false;

    try {
        modelResult = await callProviderWithReliability({
            provider: agent.primaryProvider,
            messages: messagesForModel,
            tenantId: tenant.id,
            sessionId,
            agentId: agent.id,
            requestId
        });
    } catch (primaryErr) {
        if (agent.fallbackProvider) {
            fallbackUsed = true;
            modelResult = await callProviderWithReliability({
                provider: agent.fallbackProvider,
                messages: messagesForModel,
                tenantId: tenant.id,
                sessionId,
                agentId: agent.id,
                requestId
            });
        } else {
            const err = new Error('Provider unavailable');
            err.status = 502;
            err.code = 'PROVIDER_UNAVAILABLE';
            throw err;
        }
    }
    
    // Write assistant message
    const assistant = await createMessage({
        tenantId: tenant.id,
        sessionId,
        role: 'assistant',
        content: modelResult.text
    });

    // Meter Usage
    const now = new Date().toISOString();
    const usage = await recordUsage({
        tenantId: tenant.id,
        sessionId,
        agentId: agent.id,
        provider: modelResult.providerUsed,
        tokensIn: modelResult.tokensIn,
        tokensOut: modelResult.tokensOut,
        createdAt: now
    });

    const responseObj = {
        reply: modelResult.text,
        provider: modelResult.providerUsed,
        tokensIn: modelResult.tokensIn,
        tokensOut: modelResult.tokensOut,
        costUsd: usage.costUsd,
        latencyMs: modelResult.latencyMs,
        fallbackUsed,
        assistantMessageId: assistant.id,
        requestId
    };

    // Store idempotency response
    await storeIdempotentResponse({
        tenantId: tenant.id,
        key: idempotencyKey, 
        requestHash,
        responseObj
    });

    return responseObj;
}

module.exports = { sendMessage };