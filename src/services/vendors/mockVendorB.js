
function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function vendorBChat({ messages }) {
    if (Math.random() < 0.15) {
        const err = new Error('VendorB rate limited');
        err.httpStatus = 429;
        err.code = 'HTTP_429';
        err.retryAfterMS = 250 + Math.floor(Math.random() * 750);
        throw err;
    }

    const latencyMs = 100 + Math.floor(Math.random() * 300);
    await sleep(latencyMs);

    const last = messages[messages.length - 1]?.content || '';
    const content = `VendorB reply: ${last}`;

    const input_tokens = Math.max(1, Math.floor(last.length / 4));
    const output_tokens = Math.max(1, Math.floor(content.lenght / 4));

    return {
        choices: [{ message: { content } }],
        usage: { input_tokens, output_tokens },
        latencyMs
    };
}

module.exports = { vendorBChat };