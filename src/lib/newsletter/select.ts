import type { SupabaseClient } from '@supabase/supabase-js';
import type { LifecycleStage } from '@/lib/lifecycle/autoPromote';

const SIX_WEEKS_MS = 6 * 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface MissionPathwaysData {
  readonly stageCounts: Readonly<Record<string, number>>;
  readonly recentlyMoved: ReadonlyArray<{ readonly id: string; readonly title: string; readonly lifecycle_stage: string }>;
  readonly activeCommitments: ReadonlyArray<{ readonly id: string; readonly title: string }>;
  readonly completedCommitments: ReadonlyArray<{ readonly id: string; readonly title: string }>;
  readonly testsWithActivity: ReadonlyArray<{ readonly id: string; readonly title: string }>;
  readonly stuckHunches: ReadonlyArray<{ readonly id: string; readonly title: string; readonly lifecycle_stage: string; readonly daysStuck: number }>;
}

export interface CloseContactsData {
  readonly learnings: ReadonlyArray<{ readonly id: string; readonly title: string; readonly summary: string | null }>;
  readonly testsWithActivity: ReadonlyArray<{ readonly id: string; readonly title: string }>;
  readonly coherentHunches: ReadonlyArray<{ readonly id: string; readonly title: string; readonly lifecycle_stage: string }>;
}

export type RawHunch = { id: string; title: string; lifecycle_stage: LifecycleStage; stage_transitioned_at: string | null; created_at: string };
export type RawCommitment = { id: string; title: string; status: string; updated_at: string };

export function computeStageCounts(hunches: readonly RawHunch[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const h of hunches) {
    counts[h.lifecycle_stage] = (counts[h.lifecycle_stage] ?? 0) + 1;
  }
  return counts;
}

export function filterRecentlyMoved(hunches: readonly RawHunch[], sixWeeksAgo: string): ReadonlyArray<{ id: string; title: string; lifecycle_stage: string }> {
  return hunches
    .filter(h => h.stage_transitioned_at && h.stage_transitioned_at > sixWeeksAgo)
    .map(h => ({ id: h.id, title: h.title, lifecycle_stage: h.lifecycle_stage }));
}

export function filterStuckHunches(hunches: readonly RawHunch[], thirtyDaysAgo: string, nowMs = Date.now()): ReadonlyArray<{ id: string; title: string; lifecycle_stage: string; daysStuck: number }> {
  return hunches
    .filter(h => {
      if ((['holding', 'archived'] as readonly LifecycleStage[]).includes(h.lifecycle_stage)) return false;
      const since = h.stage_transitioned_at ?? h.created_at;
      return since < thirtyDaysAgo;
    })
    .map(h => {
      const since = h.stage_transitioned_at ?? h.created_at;
      const daysStuck = Math.floor((nowMs - new Date(since).getTime()) / (24 * 60 * 60 * 1000));
      return { id: h.id, title: h.title, lifecycle_stage: h.lifecycle_stage, daysStuck };
    });
}

export function filterActiveCommitments(commitments: readonly RawCommitment[]): ReadonlyArray<{ id: string; title: string }> {
  return commitments.filter(c => c.status === 'active').map(c => ({ id: c.id, title: c.title }));
}

export function filterCompletedCommitments(commitments: readonly RawCommitment[], sixWeeksAgo: string): ReadonlyArray<{ id: string; title: string }> {
  return commitments
    .filter(c => c.status === 'complete' && c.updated_at > sixWeeksAgo)
    .map(c => ({ id: c.id, title: c.title }));
}

export async function selectMissionPathwaysNodes(supabase: SupabaseClient): Promise<MissionPathwaysData> {
  const sixWeeksAgo = new Date(Date.now() - SIX_WEEKS_MS).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();

  const [hunchesRes, commitmentsRes, testsRes] = await Promise.all([
    supabase
      .from('nodes')
      .select('id, title, lifecycle_stage, stage_transitioned_at, created_at')
      .eq('node_type', 'hunch')
      .not('status', 'in', '("archived","falsified")'),
    supabase
      .from('nodes')
      .select('id, title, status, updated_at')
      .eq('node_type', 'commitment')
      .not('status', 'in', '("archived","falsified")'),
    supabase
      .from('nodes')
      .select('id, title')
      .eq('node_type', 'test')
      .not('status', 'in', '("archived","falsified")')
      .gte('updated_at', sixWeeksAgo),
  ]);

  if (hunchesRes.error) throw new Error(`Failed to fetch hunches: ${hunchesRes.error.message}`);
  if (commitmentsRes.error) throw new Error(`Failed to fetch commitments: ${commitmentsRes.error.message}`);
  if (testsRes.error) throw new Error(`Failed to fetch tests: ${testsRes.error.message}`);

  const hunches = (hunchesRes.data ?? []) as RawHunch[];
  const commitments = (commitmentsRes.data ?? []) as RawCommitment[];
  const tests = (testsRes.data ?? []) as Array<{ id: string; title: string }>;

  return {
    stageCounts: computeStageCounts(hunches),
    recentlyMoved: filterRecentlyMoved(hunches, sixWeeksAgo),
    activeCommitments: filterActiveCommitments(commitments),
    completedCommitments: filterCompletedCommitments(commitments, sixWeeksAgo),
    testsWithActivity: tests.map(t => ({ id: t.id, title: t.title })),
    stuckHunches: filterStuckHunches(hunches, thirtyDaysAgo),
  };
}

export async function selectCloseContactsNodes(supabase: SupabaseClient): Promise<CloseContactsData> {
  const sixWeeksAgo = new Date(Date.now() - SIX_WEEKS_MS).toISOString();

  const [learningsRes, testsRes, hunchesRes] = await Promise.all([
    supabase
      .from('nodes')
      .select('id, title, description')
      .eq('node_type', 'learning')
      .not('status', 'in', '("archived","falsified")')
      .gte('created_at', sixWeeksAgo),
    supabase
      .from('nodes')
      .select('id, title')
      .eq('node_type', 'test')
      .not('status', 'in', '("archived","falsified")')
      .gte('updated_at', sixWeeksAgo),
    supabase
      .from('nodes')
      .select('id, title, lifecycle_stage')
      .eq('node_type', 'hunch')
      .not('status', 'in', '("archived","falsified")')
      .in('lifecycle_stage', ['coherence', 'holding'])
      .gte('updated_at', sixWeeksAgo),
  ]);

  if (learningsRes.error) throw new Error(`Failed to fetch learnings: ${learningsRes.error.message}`);
  if (testsRes.error) throw new Error(`Failed to fetch tests: ${testsRes.error.message}`);
  if (hunchesRes.error) throw new Error(`Failed to fetch hunches: ${hunchesRes.error.message}`);

  return {
    learnings: (learningsRes.data ?? []).map(l => ({
      id: l.id as string,
      title: l.title as string,
      summary: (l.description ?? null) as string | null,
    })),
    testsWithActivity: (testsRes.data ?? []).map(t => ({
      id: t.id as string,
      title: t.title as string,
    })),
    coherentHunches: (hunchesRes.data ?? []).map(h => ({
      id: h.id as string,
      title: h.title as string,
      lifecycle_stage: h.lifecycle_stage as string,
    })),
  };
}
