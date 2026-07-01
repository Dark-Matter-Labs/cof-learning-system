import { describe, it, expect } from 'vitest';
import { getSemanticMatchableTypes } from '../captureTypes';

describe('getSemanticMatchableTypes', () => {
  it('returns exactly the knowledge/claim types', () => {
    expect([...getSemanticMatchableTypes()].sort()).toEqual(
      ['assumption_background', 'assumption_foreground', 'hunch', 'learning', 'option', 'signal'].sort(),
    );
  });

  it('excludes entity/structural and action types', () => {
    const set = getSemanticMatchableTypes();
    for (const t of ['test', 'commitment', 'goal_space', 'trigger_outcome', 'meeting_notes']) {
      expect(set).not.toContain(t);
    }
  });
});
