import { describe, it, expect } from 'vitest';
import { estimateCostMicroCents } from '../usage';

describe('estimateCostMicroCents', () => {
  it('estimates cost for Haiku model', () => {
    // Haiku: $0.00025/1k input, $0.00125/1k output
    // 1000 input + 1000 output = $0.00025 + $0.00125 = $0.0015 = 150 micro-cents
    const cost = estimateCostMicroCents('claude-haiku-4-5-20251001', 1000, 1000);
    expect(cost).toBe(150);
  });

  it('estimates cost for Sonnet model', () => {
    // Sonnet: $0.003/1k input, $0.015/1k output
    // 1000 input + 1000 output = $0.003 + $0.015 = $0.018 = 1800 micro-cents
    const cost = estimateCostMicroCents('claude-sonnet-4-6', 1000, 1000);
    expect(cost).toBe(1800);
  });

  it('returns 0 for cached calls (no token cost)', () => {
    const cost = estimateCostMicroCents('claude-sonnet-4-6', 0, 0);
    expect(cost).toBe(0);
  });
});
