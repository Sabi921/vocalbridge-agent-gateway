
const { env } = require('../config/env');

function pricePer1k(provider) {
    if (provider === 'vendorA') return env.PRICE_VENDOR_A_PER_1K;
    if (provider === 'vendorB') return env.PRICE_VENDOR_B_PER_1K;

    throw Object.assign(new Error('Unknown provider for billing'), { status: 400, code: 'Bad_Provider' });
}

function computeCostUsd(provider, tokensIn, tokensOut) {
    const rate = pricePer1k(provider);
    const totalTokens = tokensIn + tokensOut;
    return (totalTokens / 1000) * rate;
}

module.exports = { computeCostUsd };