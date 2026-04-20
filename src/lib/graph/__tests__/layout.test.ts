import { describe, it, expect } from 'vitest';
import { CARD_WIDTH, CARD_HEIGHT, COMMIT_SIZE } from '../layout';

describe('layout constants', () => {
  it('CARD_WIDTH is 200', () => {
    expect(CARD_WIDTH).toBe(200);
  });

  it('CARD_HEIGHT is 80', () => {
    expect(CARD_HEIGHT).toBe(80);
  });

  it('COMMIT_SIZE is 80', () => {
    expect(COMMIT_SIZE).toBe(80);
  });
});
