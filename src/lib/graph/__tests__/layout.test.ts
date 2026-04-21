import { describe, it, expect } from 'vitest';
import { computeGoalCentroids, buildClusterForce, CARD_WIDTH, CARD_HEIGHT, COMMIT_SIZE } from '../layout';
import type { GraphNode } from '../layout';

function makeNode(id: string, node_type: string): GraphNode & { vx: number; vy: number; x: number; y: number } {
  return { id, node_type, title: id, color: '#fff', radius: 14, data: {} as never, vx: 0, vy: 0, x: 0, y: 0, index: 0 };
}

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

describe('computeGoalCentroids', () => {
  it('returns empty map when no goal spaces', () => {
    const result = computeGoalCentroids(new Map(), 800, 600);
    expect(result.size).toBe(0);
  });

  it('places single goal space at canvas center', () => {
    const gsMap = new Map([['n1', 'gs1'], ['n2', 'gs1']]);
    const result = computeGoalCentroids(gsMap, 800, 600);
    expect(result.has('gs1')).toBe(true);
    const c = result.get('gs1')!;
    expect(c.x).toBeGreaterThan(0);
    expect(c.x).toBeLessThan(800);
    expect(c.y).toBeGreaterThan(0);
    expect(c.y).toBeLessThan(600);
  });

  it('places multiple goal spaces within canvas bounds', () => {
    const gsMap = new Map([['n1', 'gs1'], ['n2', 'gs2'], ['n3', 'gs3']]);
    const result = computeGoalCentroids(gsMap, 800, 600);
    expect(result.size).toBe(3);
    for (const { x, y } of result.values()) {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(800);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(600);
    }
  });
});

describe('buildClusterForce', () => {
  it('applies velocity toward goal space centroid', () => {
    const nodeGoalMap = new Map([['n1', 'gs1']]);
    const goalCentroids = new Map([['gs1', { x: 400, y: 300 }]]);
    const force = buildClusterForce(nodeGoalMap, goalCentroids);

    const n1 = makeNode('n1', 'hunch');
    n1.x = 0; n1.y = 0; n1.vx = 0; n1.vy = 0;

    (force as typeof force & { initialize: (nodes: GraphNode[]) => void }).initialize([n1]);
    force(1);

    expect(n1.vx).toBeGreaterThan(0);
    expect(n1.vy).toBeGreaterThan(0);
  });

  it('does not move nodes without goal space assignment', () => {
    const nodeGoalMap = new Map<string, string>();
    const goalCentroids = new Map<string, { x: number; y: number }>();
    const force = buildClusterForce(nodeGoalMap, goalCentroids);

    const n1 = makeNode('n1', 'hunch');
    n1.x = 0; n1.y = 0; n1.vx = 0; n1.vy = 0;
    (force as typeof force & { initialize: (nodes: GraphNode[]) => void }).initialize([n1]);
    force(1);

    expect(n1.vx).toBe(0);
    expect(n1.vy).toBe(0);
  });
});
