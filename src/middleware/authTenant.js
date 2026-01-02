
const { getDb } = require('../db');
const { sha256Hex } = require('../utils/crypto');

async function authTenant(req, res, next) {
    try {
        const apiKey = req.header('x-api-key');
        if (!apiKey) {
            return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing x-api-key' } }); 
        }

        const apiKeyHash = sha256Hex(apiKey);
        const db = await getDb();
        const tenant = await db.get('SELECT id, name, createdAt FROM Tenant WHERE apiKeyHash = ?', apiKeyHash);

        if (!tenant) {
            return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid API key' } });
        }

        req.tenant = tenant;
        next();
    } catch (e) {
        next(e);
    }
}

module.exports = { authTenant };