import { describe, it, expect } from 'vitest';
import { extractKeywords, isRelevant, scoreRelevance } from '../relevanceFilter';

describe('extractKeywords', () => {
  it('splits title into lowercase words, filters short words', () => {
    const keywords = extractKeywords(['Formation Capital Strategy']);
    expect(keywords).toContain('formation');
    expect(keywords).toContain('capital');
    expect(keywords).toContain('strategy');
    expect(keywords).not.toContain('of');
  });

  it('handles multiple topics', () => {
    const keywords = extractKeywords(['Dartmoor Rewilding Project', 'Natural Assets Fund']);
    expect(keywords).toContain('dartmoor');
    expect(keywords).toContain('rewilding');
    expect(keywords).toContain('natural');
    expect(keywords).toContain('assets');
  });
});

describe('isRelevant', () => {
  const keywords = ['formation', 'capital', 'rewilding', 'dartmoor'];

  it('returns true when content contains a keyword', () => {
    expect(isRelevant('New formation capital fund announced', keywords)).toBe(true);
  });

  it('returns false when no keywords match', () => {
    expect(isRelevant('Football scores for the weekend', keywords)).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isRelevant('DARTMOOR national park', keywords)).toBe(true);
  });

  it('returns false for empty content', () => {
    expect(isRelevant('', keywords)).toBe(false);
  });
});

describe('scoreRelevance', () => {
  it('returns 0 for no matches', () => {
    expect(scoreRelevance('unrelated content', ['formation', 'capital'])).toBe(0);
  });

  it('returns higher score for more keyword matches', () => {
    const score1 = scoreRelevance('formation fund', ['formation', 'capital', 'fund']);
    const score2 = scoreRelevance('formation capital fund', ['formation', 'capital', 'fund']);
    expect(score2).toBeGreaterThan(score1);
  });
});
