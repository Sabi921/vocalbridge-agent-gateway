
async function withTimeout(promise, ms) {
    let t;
    const timeout = new Promise((_, rej) => {
        t = setTimeout(() => {
            const err = new Error('Timed out');
            err.code = 'TIMEOUT';
            err.httpStatus = 408;
            rej(err);
        }, ms);
    });

    try {
        return await Promise.race([promise, timeout]);
    } finally {
        clearTimeout(t);
    }
}

module.exports = { withTimeout };