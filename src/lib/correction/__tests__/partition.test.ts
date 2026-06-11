import { describe, it, expect } from 'vitest';
import { partitionCorrectionActions } from '../agent';
import type { CorrectionAction } from '../agent';

const A = 'aaaaaaaa-0000-0000-0000-000000000000';
const B = 'bbbbbbbb-0000-0000-0000-000000000000';
const EVIL = 'eeeeeeee-0000-0000-0000-000000000000';

describe('partitionCorrectionActions', () => {
  it('keeps update/archive actions whose node_id was in context', () => {
    const actions: CorrectionAction[] = [
      { action: 'update', node_id: A, fields: { title: 'fixed' } },
      { action: 'archive', node_id: B },
    ];
    const { allowed, rejected } = partitionCorrectionActions(actions, new Set([A, B]));
    expect(allowed).toHaveLength(2);
    expect(rejected).toHaveLength(0);
  });

  it('rejects update/archive targeting a node that was NOT in context', () => {
    const actions: CorrectionAction[] = [
      { action: 'update', node_id: A, fields: { title: 'ok' } },
      { action: 'archive', node_id: EVIL },
      { action: 'update', node_id: EVIL, fields: { description: 'tamper' } },
    ];
    const { allowed, rejected } = partitionCorrectionActions(actions, new Set([A]));
    expect(allowed).toEqual([{ action: 'update', node_id: A, fields: { title: 'ok' } }]);
    expect(rejected).toHaveLength(2);
    expect(rejected.every(a => 'node_id' in a && a.node_id === EVIL)).toBe(true);
  });

  it('always allows create actions (they have no target node_id)', () => {
    const actions: CorrectionAction[] = [
      { action: 'create', node_type: 'learning', title: 'New', description: 'desc' },
    ];
    const { allowed, rejected } = partitionCorrectionActions(actions, new Set());
    expect(allowed).toHaveLength(1);
    expect(rejected).toHaveLength(0);
  });
});
