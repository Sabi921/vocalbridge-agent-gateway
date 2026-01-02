
const { vendorAChat } = require('./mockVendorA');
const { vendorBChat } = require('./mockVendorB');

function estimateTokens(text) {
  return Math.max(1, Math.floor((text || '').length / 4));
}

function getAdapter(provider) {
  if (provider === 'vendorA') {
    return {
      name: 'vendorA',
      async chat({ messages }) {
        const r = await vendorAChat({ messages });
        const text = r.outputText ?? '';
        const tokensIn = Number.isFinite(r.tokensIn) ? r.tokensIn : estimateTokens(messages[messages.length - 1]?.content);
        const tokensOut = Number.isFinite(r.tokensOut) ? r.tokensOut : estimateTokens(text);
        return { text, tokensIn, tokensOut, latencyMs: r.latencyMs ?? 0 };
      }
    };
  }

  if (provider === 'vendorB') {
    return {
      name: 'vendorB',
      async chat({ messages }) {
        const r = await vendorBChat({ messages });

        const text = r?.choices?.[0]?.message?.content ?? '';

        const inTok = r?.usage?.input_tokens;
        const outTok = r?.usage?.output_tokens;

        const tokensIn = Number.isFinite(inTok) ? inTok : estimateTokens(messages[messages.length - 1]?.content);
        const tokensOut = Number.isFinite(outTok) ? outTok : estimateTokens(text);

        return { text, tokensIn, tokensOut, latencyMs: r.latencyMs ?? 0 };
      }
    };
  }

  throw Object.assign(new Error('Unknown provider'), { status: 400, code: 'BAD_PROVIDER' });
}

module.exports = { getAdapter };
