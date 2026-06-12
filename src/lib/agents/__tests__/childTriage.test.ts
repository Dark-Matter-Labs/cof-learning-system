import { describe, it, expect } from 'vitest';
import { childReviewStatus, CHILD_AUTO_PROMOTE_CONFIDENCE } from '../childTriage';

describe('childReviewStatus', () => {
  it('auto-promotes high-confidence children (5, 4)', () => {
    expect(childReviewStatus(5)).toBe('promoted');
    expect(childReviewStatus(4)).toBe('promoted');
  });

  it('flags low-confidence children (3, 2, 1)', () => {
    expect(childReviewStatus(3)).toBe('flagged_for_review');
    expect(childReviewStatus(2)).toBe('flagged_for_review');
    expect(childReviewStatus(1)).toBe('flagged_for_review');
  });

  it('uses the threshold constant as the boundary', () => {
    expect(childReviewStatus(CHILD_AUTO_PROMOTE_CONFIDENCE)).toBe('promoted');
    expect(childReviewStatus(CHILD_AUTO_PROMOTE_CONFIDENCE - 1)).toBe('flagged_for_review');
  });
});
