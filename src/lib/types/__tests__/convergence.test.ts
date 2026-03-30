import { describe, it, expect } from 'vitest';
import { shouldTriggerReflection } from '../convergence';

describe('shouldTriggerReflection', () => {
  it('returns true when delta >= 10 and lastReflectionAt is null', () => {
    expect(shouldTriggerReflection(15, 5, null)).toBe(true);
  });

  it('returns false when delta < 10 and lastReflectionAt is null', () => {
    expect(shouldTriggerReflection(14, 5, null)).toBe(false);
  });

  it('returns true when delta >= 10 and last reflection > 24h ago', () => {
    const moreThan24hAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
    expect(shouldTriggerReflection(15, 5, moreThan24hAgo)).toBe(true);
  });

  it('returns false when delta >= 10 but last reflection only 1h ago', () => {
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);
    expect(shouldTriggerReflection(15, 5, oneHourAgo)).toBe(false);
  });

  it('returns true with custom threshold=5 when delta >= 5', () => {
    expect(shouldTriggerReflection(15, 5, null, 5)).toBe(true);
  });

  it('returns true when lastReflectionNodeCount is 0 and nodeCountNow is 10', () => {
    expect(shouldTriggerReflection(10, 0, null)).toBe(true);
  });

  it('returns false when nodeCountNow=9 and lastReflectionNodeCount=0 (delta=9 < 10)', () => {
    expect(shouldTriggerReflection(9, 0, null)).toBe(false);
  });

  it('returns false when delta >= 10 but last reflection only 23h ago', () => {
    const twentyThreeHoursAgo = new Date(Date.now() - 23 * 60 * 60 * 1000);
    expect(shouldTriggerReflection(20, 5, twentyThreeHoursAgo)).toBe(false);
  });
});
