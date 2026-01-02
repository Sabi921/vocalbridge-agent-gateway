
const express = require('express');

function healthRoutes() {
    const r = express.Router();
    r.get('/', (req, res) => res.json({ ok: true }));
    return r;
}

module.exports = { healthRoutes };