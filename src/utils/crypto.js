
const crypto = require('crypto');

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function stableJsonHash(obj) {
  return sha256Hex(JSON.stringify(obj));
}

module.exports = { sha256Hex, stableJsonHash };