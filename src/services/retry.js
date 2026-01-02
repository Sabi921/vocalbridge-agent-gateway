
const { env } = require('../config/env');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function isTransient(err) {
  return err?.code === 'TIMEOUT' || err?.httpStatus === 500 || err?.httpStatus === 429;
}

function computeDelay(attempt, err) {
  if (err?.httpStatus === 429 && typeof err.retryAfterMs === 'number') {
    return Math.min(err.retryAfterMs, env.RETRY_MAX_DELAY_MS);
  }
  const base = env.RETRY_BASE_DELAY_MS * (2 ** (attempt -1));
  const jitter = Math.floor(Math.random() * 80);
  return Math.min(base + jitter, env.RETRY_MAX_DELAY_MS);
}

async function withRetry(fn, { maxAttempts = env.RETRY_MAX_ATTEMPTS } = {}) {
  let lastErr;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (!isTransient(err)) {
        throw err;
      }
      if (attempt === maxAttempts) {
        break;
      }
      await sleep(computeDelay(attempt, err));
    }
  }

  throw lastErr;
}

module.exports = { withRetry, isTransient };