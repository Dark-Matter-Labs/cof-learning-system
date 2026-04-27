export interface FocusItem {
  readonly type: 'tension' | 'stale_commitment' | 'unprocessed_captures' | 'signal_ready';
  readonly title: string;
  readonly subtitle: string;
  readonly href: string;
  readonly id: string;
}

export interface SystemPulseData {
  readonly lastCaptureAt: string | null;
  readonly thisWeekCount: number;
  readonly activeCommitmentsCount: number;
  readonly openTensionsCount: number;
  readonly hunchesInFlightCount: number;
}

export interface TrajectoryItem {
  readonly goalSpaceId: string;
  readonly goalSpaceTitle: string;
  readonly latestScore: number;
  readonly direction: 'up' | 'down' | 'flat';
  readonly delta: number;
}

export interface RhythmData {
  readonly dailyCaptures: readonly boolean[];
  readonly weeklyReviewDone: boolean;
  readonly monthlyReflectionDone: boolean;
  readonly todayIndex: number;
}

export interface ActivityNode {
  readonly id: string;
  readonly title: string;
  readonly node_type: string;
  readonly created_at: string;
}

export interface RecentActivityGroup {
  readonly label: string;
  readonly items: readonly ActivityNode[];
}

export function groupByDate(nodes: ActivityNode[]): RecentActivityGroup[] {
  if (nodes.length === 0) return [];

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(todayStart.getDate() - 1);

  const groupMap = new Map<string, { label: string; items: ActivityNode[] }>();

  for (const node of nodes) {
    const date = new Date(node.created_at);
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const key = dayStart.toISOString();

    if (!groupMap.has(key)) {
      let label: string;
      if (dayStart >= todayStart) {
        label = 'Today';
      } else if (dayStart >= yesterdayStart) {
        label = 'Yesterday';
      } else {
        label = dayStart.toLocaleDateString('en-GB', { weekday: 'long', month: 'short', day: 'numeric' });
      }
      groupMap.set(key, { label, items: [] });
    }
    groupMap.get(key)!.items.push(node);
  }

  return Array.from(groupMap.values());
}

export function computeDailyCaptures(
  nodes: ReadonlyArray<{ readonly created_at: string }>,
  weekStart: Date
): boolean[] {
  const days = [false, false, false, false, false];
  const weekStartUtc = Date.UTC(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());

  for (const node of nodes) {
    const date = new Date(node.created_at);
    const dayStartUtc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    const diff = Math.floor((dayStartUtc - weekStartUtc) / (24 * 60 * 60 * 1000));
    if (diff >= 0 && diff <= 4) {
      days[diff] = true;
    }
  }
  return days;
}

export function computeTrajectoryItems(
  goalSpaces: ReadonlyArray<{ readonly id: string; readonly title: string }>,
  snapshots: ReadonlyArray<{ readonly goal_space_id: string; readonly score: number; readonly computed_at: string }>
): TrajectoryItem[] {
  return goalSpaces.map(gs => {
    const sorted = snapshots
      .filter(s => s.goal_space_id === gs.id)
      .sort((a, b) => new Date(b.computed_at).getTime() - new Date(a.computed_at).getTime());

    if (sorted.length === 0) {
      return { goalSpaceId: gs.id, goalSpaceTitle: gs.title, latestScore: 0, direction: 'flat' as const, delta: 0 };
    }

    const latest = sorted[0].score;
    const previous = sorted[1]?.score ?? null;

    if (previous === null) {
      return { goalSpaceId: gs.id, goalSpaceTitle: gs.title, latestScore: latest, direction: 'flat' as const, delta: 0 };
    }

    const delta = Math.round((latest - previous) * 100);
    const direction = delta > 2 ? 'up' as const : delta < -2 ? 'down' as const : 'flat' as const;
    return { goalSpaceId: gs.id, goalSpaceTitle: gs.title, latestScore: latest, direction, delta };
  });
}

export function getWeekStart(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysFromMonday);
}

export function getTodayIndex(): number {
  const day = new Date().getDay();
  return day === 0 ? 6 : day - 1;
}
