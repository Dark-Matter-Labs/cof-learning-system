import { describe, it, expect } from 'vitest';
import {
  computeStageCounts,
  filterRecentlyMoved,
  filterStuckHunches,
  filterActiveCommitments,
  filterCompletedCommitments,
  type RawHunch,
  type RawCommitment,
} from '../select';

const OLD = new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString();
const RECENT = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
const SIX_WEEKS_AGO = new Date(Date.now() - 6 * 7 * 24 * 60 * 60 * 1000).toISOString();
const THIRTY_DAYS_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

describe('computeStageCounts', () => {
  it('counts hunches by lifecycle stage', () => {
    const hunches: RawHunch[] = [
      { id: 'h1', title: 'A', lifecycle_stage: 'hypothesis', stage_transitioned_at: null, created_at: OLD },
      { id: 'h2', title: 'B', lifecycle_stage: 'hypothesis', stage_transitioned_at: null, created_at: OLD },
      { id: 'h3', title: 'C', lifecycle_stage: 'navigation', stage_transitioned_at: null, created_at: OLD },
    ];
    const counts = computeStageCounts(hunches);
    expect(counts['hypothesis']).toBe(2);
    expect(counts['navigation']).toBe(1);
    expect(counts['coherence']).toBeUndefined();
  });

  it('returns empty object for no hunches', () => {
    expect(computeStageCounts([])).toEqual({});
  });
});

describe('filterRecentlyMoved', () => {
  it('returns hunches that moved stages within the window', () => {
    const hunches: RawHunch[] = [
      { id: 'h1', title: 'Recent', lifecycle_stage: 'navigation', stage_transitioned_at: RECENT, created_at: OLD },
      { id: 'h2', title: 'Old', lifecycle_stage: 'uncertainty', stage_transitioned_at: OLD, created_at: OLD },
      { id: 'h3', title: 'NoDate', lifecycle_stage: 'hypothesis', stage_transitioned_at: null, created_at: OLD },
    ];
    const moved = filterRecentlyMoved(hunches, SIX_WEEKS_AGO);
    expect(moved).toHaveLength(1);
    expect(moved[0].title).toBe('Recent');
  });
});

describe('filterStuckHunches', () => {
  it('returns hunches stuck 30+ days', () => {
    const hunches: RawHunch[] = [
      { id: 'h1', title: 'Stuck', lifecycle_stage: 'uncertainty', stage_transitioned_at: OLD, created_at: OLD },
      { id: 'h2', title: 'Fresh', lifecycle_stage: 'uncertainty', stage_transitioned_at: RECENT, created_at: RECENT },
    ];
    const stuck = filterStuckHunches(hunches, THIRTY_DAYS_AGO);
    expect(stuck).toHaveLength(1);
    expect(stuck[0].title).toBe('Stuck');
    expect(stuck[0].daysStuck).toBeGreaterThanOrEqual(40);
  });

  it('excludes holding and archived hunches', () => {
    const hunches: RawHunch[] = [
      { id: 'h1', title: 'Holding', lifecycle_stage: 'holding', stage_transitioned_at: OLD, created_at: OLD },
      { id: 'h2', title: 'Archived', lifecycle_stage: 'archived', stage_transitioned_at: OLD, created_at: OLD },
    ];
    expect(filterStuckHunches(hunches, THIRTY_DAYS_AGO)).toHaveLength(0);
  });

  it('falls back to created_at when stage_transitioned_at is null', () => {
    const hunches: RawHunch[] = [
      { id: 'h1', title: 'OldCreate', lifecycle_stage: 'hypothesis', stage_transitioned_at: null, created_at: OLD },
    ];
    const stuck = filterStuckHunches(hunches, THIRTY_DAYS_AGO);
    expect(stuck).toHaveLength(1);
  });
});

describe('filterActiveCommitments', () => {
  it('returns only active commitments', () => {
    const commitments: RawCommitment[] = [
      { id: 'c1', title: 'Active', status: 'active', updated_at: RECENT },
      { id: 'c2', title: 'Complete', status: 'complete', updated_at: RECENT },
      { id: 'c3', title: 'Archived', status: 'archived', updated_at: RECENT },
    ];
    const active = filterActiveCommitments(commitments);
    expect(active).toHaveLength(1);
    expect(active[0].title).toBe('Active');
  });
});

describe('filterCompletedCommitments', () => {
  it('returns commitments completed within the window', () => {
    const commitments: RawCommitment[] = [
      { id: 'c1', title: 'RecentDone', status: 'complete', updated_at: RECENT },
      { id: 'c2', title: 'OldDone', status: 'complete', updated_at: OLD },
      { id: 'c3', title: 'Active', status: 'active', updated_at: RECENT },
    ];
    const completed = filterCompletedCommitments(commitments, SIX_WEEKS_AGO);
    expect(completed).toHaveLength(1);
    expect(completed[0].title).toBe('RecentDone');
  });
});
