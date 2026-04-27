import { describe, it, expect } from 'vitest';
import { groupByDate, computeDailyCaptures, computeTrajectoryItems, getTodayIndex, getWeekStart } from '../queries';

describe('groupByDate', () => {
  it('labels today and yesterday correctly', () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const nodes = [
      { id: '1', title: 'A', node_type: 'hunch', created_at: now.toISOString() },
      { id: '2', title: 'B', node_type: 'signal', created_at: yesterday.toISOString() },
    ];
    const groups = groupByDate(nodes);
    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe('Today');
    expect(groups[1].label).toBe('Yesterday');
    expect(groups[0].items[0].title).toBe('A');
  });

  it('returns empty array for empty input', () => {
    expect(groupByDate([])).toEqual([]);
  });
});

describe('computeDailyCaptures', () => {
  it('returns 5 booleans, true if a node was created that weekday', () => {
    const weekStart = new Date('2026-04-27T00:00:00Z'); // Monday
    const nodes = [
      { created_at: '2026-04-27T10:00:00Z' }, // Monday
      { created_at: '2026-04-28T10:00:00Z' }, // Tuesday
    ];
    const result = computeDailyCaptures(nodes, weekStart);
    expect(result).toHaveLength(5);
    expect(result[0]).toBe(true);
    expect(result[1]).toBe(true);
    expect(result[2]).toBe(false);
    expect(result[3]).toBe(false);
    expect(result[4]).toBe(false);
  });

  it('ignores nodes outside Mon-Fri window', () => {
    const weekStart = new Date('2026-04-27T00:00:00Z');
    const nodes = [{ created_at: '2026-05-04T10:00:00Z' }]; // next Monday
    expect(computeDailyCaptures(nodes, weekStart)).toEqual([false, false, false, false, false]);
  });
});

describe('computeTrajectoryItems', () => {
  it('marks direction up when latest score higher', () => {
    const goalSpaces = [{ id: 'gs1', title: 'Formation Capital' }];
    const snapshots = [
      { goal_space_id: 'gs1', score: 0.7, computed_at: '2026-04-27T00:00:00Z' },
      { goal_space_id: 'gs1', score: 0.5, computed_at: '2026-04-20T00:00:00Z' },
    ];
    const result = computeTrajectoryItems(goalSpaces, snapshots);
    expect(result[0].direction).toBe('up');
    expect(result[0].delta).toBe(20);
    expect(result[0].goalSpaceTitle).toBe('Formation Capital');
  });

  it('marks direction down when latest score lower', () => {
    const goalSpaces = [{ id: 'gs1', title: 'Natural Assets' }];
    const snapshots = [
      { goal_space_id: 'gs1', score: 0.4, computed_at: '2026-04-27T00:00:00Z' },
      { goal_space_id: 'gs1', score: 0.7, computed_at: '2026-04-20T00:00:00Z' },
    ];
    const result = computeTrajectoryItems(goalSpaces, snapshots);
    expect(result[0].direction).toBe('down');
    expect(result[0].delta).toBe(-30);
  });

  it('marks flat for single snapshot', () => {
    const goalSpaces = [{ id: 'gs1', title: 'Biodiversity' }];
    const snapshots = [{ goal_space_id: 'gs1', score: 0.5, computed_at: '2026-04-27T00:00:00Z' }];
    const result = computeTrajectoryItems(goalSpaces, snapshots);
    expect(result[0].direction).toBe('flat');
    expect(result[0].delta).toBe(0);
  });

  it('returns goal space with no snapshots as flat', () => {
    const goalSpaces = [{ id: 'gs1', title: 'Empty' }];
    const result = computeTrajectoryItems(goalSpaces, []);
    expect(result[0].direction).toBe('flat');
  });
});

describe('getWeekStart', () => {
  it('returns a Date at midnight', () => {
    const ws = getWeekStart();
    expect(ws.getHours()).toBe(0);
    expect(ws.getMinutes()).toBe(0);
  });
});

describe('getTodayIndex', () => {
  it('returns a number between 0 and 6', () => {
    const idx = getTodayIndex();
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThanOrEqual(6);
  });
});
