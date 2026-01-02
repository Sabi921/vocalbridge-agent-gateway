
const { ulid } = require('ulid');

function requestId(req, res, next) {
    const id = req.header('x-request-id') || ulid();
    req. requestId = id;
    res.setHeader('x-request-id', id);
    next();
}

module.exports = { requestId };