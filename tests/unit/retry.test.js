
const { withRetry } = require('../../src/services/retry');

describe('retry.withRetry', () => {
  it('retries transient 500 errors and eventually succeeds', async () => {
    let calls = 0;

    const result = await withRetry(async () => {
      calls += 1;
      if (calls < 3) {
        const err = new Error('boom');
        err.httpStatus = 500;
        err.code = 'HTTP_500';
        throw err;
      }
      return 'ok';
    }, { maxAttempts: 4 });

    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  it('retries transient TIMEOUT and eventually fails after maxAttempts', async () => {
    let calls = 0;
    await expect(
      withRetry(async () => {
        calls += 1;
        const err = new Error('timeout');
        err.code = 'TIMEOUT';
        err.httpStatus = 408;
        throw err;
      }, { maxAttempts: 3 })
    ).rejects.toBeTruthy();

    expect(calls).toBe(3);
  });

  it('does NOT retry non-transient errors (e.g., 400)', async () => {
    let calls = 0;

    await expect(
      withRetry(async () => {
        calls += 1;
        const err = new Error('bad request');
        err.httpStatus = 400;
        err.code = 'HTTP_400';
        throw err;
      }, { maxAttempts: 5 })
    ).rejects.toBeTruthy();

    expect(calls).toBe(1);
  });
});
