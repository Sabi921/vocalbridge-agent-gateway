
function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function vendorAChat({ messages }) {
    if (Math.random() < 0.10) {
        const err = new Error('VendorA internal error');
        err.httpStatus = 500;
        err.code = 'HTTP_500';
        throw err;
    }

    // random slowness
    const latencyMs = Math.random() < 0.20 ? 1800 + Math.floor(Math.random() * 800) : 120 + Math.floor(Math.random() * 200);
    await sleep(latencyMs);

    const last = messages[messages.length - 1]?.content || '';
    const outputText = `VendorA reply: ${last}`;

    const tokensIn = Math.max(1, Math.floor(last.length / 4));
    const tokensOut = Math.max(1, Math.floor(outputText.length / 4));

    return { outputText, tokensIn, tokensOut, latencyMs };
}

module.exports = { vendorAChat };