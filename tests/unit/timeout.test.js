
const { withTimeout } = require('../../src/services/timeout');

describe('timeout.withTimeout', () => {
  it('resolves if promise finishes in time', async () => {
    const v = await withTimeout(Promise.resolve('ok'), 50);
    expect(v).toBe('ok');
  });

  it('throws TIMEOUT if promise exceeds time', async () => {
    const slow = new Promise((r) => setTimeout(() => r('late'), 50));
    await expect(withTimeout(slow, 10)).rejects.toMatchObject({ code: 'TIMEOUT' });
  });
});
