import { describe, it, expect } from 'vitest';
import { estimateCostMicroCents } from '../usage';

describe('estimateCostMicroCents', () => {
  it('estimates cost for Haiku model', () => {
    // Haiku 4.5: $1/MTok input, $5/MTok output → $0.001/1k in, $0.005/1k out
    // 1000 input + 1000 output = $0.001 + $0.005 = $0.006 = 600 micro-cents
    const cost = estimateCostMicroCents('claude-haiku-4-5-20251001', 1000, 1000);
    expect(cost).toBe(600);
  });

  it('estimates cost for Opus model', () => {
    // Opus 4.8: $5/MTok input, $25/MTok output → $0.005/1k in, $0.025/1k out
    // 1000 input + 1000 output = $0.005 + $0.025 = $0.03 = 3000 micro-cents
    const cost = estimateCostMicroCents('claude-opus-4-8', 1000, 1000);
    expect(cost).toBe(3000);
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
