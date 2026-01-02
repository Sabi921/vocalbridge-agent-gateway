
const { computeCostUsd } = require('../../src/utils/pricing');

describe('pricing.computeCostUsd', () => {
  it('calculates vendorA pricing correctly', () => {
    // 1000 tokens total * 0.002 / 1K = 0.002
    const cost = computeCostUsd('vendorA', 400, 600);
    expect(cost).toBeCloseTo(0.002, 8);
  });

  it('calculates vendorB pricing correctly', () => {
    // 2000 tokens total * 0.003 / 1K = 0.006
    const cost = computeCostUsd('vendorB', 1200, 800);
    expect(cost).toBeCloseTo(0.006, 8);
  });

  it('throws on unknown provider', () => {
    expect(() => computeCostUsd('vendorZ', 1, 1)).toThrow();
  });
});
