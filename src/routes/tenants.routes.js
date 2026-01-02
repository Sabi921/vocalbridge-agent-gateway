
const express = require('express');
const { getDb } = require('../db');
const { ulid } = require('ulid');
const crypto = require('crypto');
const { sha256Hex } = require('../utils/crypto');


function randomApiKey() {
    return crypto.randomBytes(24).toString('hex');
}

function tenantsRoutes() {
    const r = express.Router();

    r.post('/create', async (req, res, next) => {
        try{
            const { name } = req.body || {};
            if (!name) return res.status(400).json({error: {code: 'BAD_REQUEST', message: 'name required' } });

            const apiKey = randomApiKey();
            const apiKeyHash = sha256Hex(apiKey);

            const db = await getDb();
            const id = ulid();
            const createdAt = new Date().toISOString();

            await db.run(
                'INSERT INTO Tenant (id, name, apiKeyHash, createdAt) VALUES (?, ?, ?, ?)',
                id, name, apiKeyHash, createdAt
            );

            res.json({ tenant: {id, name, createdAt }, apiKey });
        } catch (e) { next(e); }
    });
    return r;
}

module.exports = { tenantsRoutes };