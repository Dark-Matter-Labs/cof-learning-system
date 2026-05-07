import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { FocusToday } from '@/components/dashboard/FocusToday';
import { SystemPulse } from '@/components/dashboard/SystemPulse';
import { Trajectory } from '@/components/dashboard/Trajectory';
import { WeeklyRhythm } from '@/components/dashboard/WeeklyRhythm';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import {
  groupByDate,
  computeDailyCaptures,
  computeTrajectoryItems,
  getWeekStart,
  getTodayIndex,
} from '@/lib/dashboard/queries';
import { getKnowledgeReviewTypes } from '@/lib/config/captureTypes';
import type { FocusItem, SystemPulseData, HunchStageCounts, RhythmData, ActivityNode } from '@/lib/dashboard/queries';

function greeting(name: string | null): string {
  const h = new Date().getHours();
  const first = name?.split(' ')[0] ?? 'there';
  if (h < 12) return `Good morning, ${first}`;
  if (h < 17) return `Good afternoon, ${first}`;
  return `Good evening, ${first}`;
}

function todayLabel(): string {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login');

  const { data: goalSpaceCheck } = await supabase
    .from('nodes').select('id').eq('node_type', 'goal_space').neq('status', 'archived').limit(1);
  if (!goalSpaceCheck || goalSpaceCheck.length === 0) redirect('/setup');

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const weekStart = getWeekStart();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [
    profileRes,
    tensionsRes,
    staleCommitmentsRes,
    unprocessedRes,
    allGoalSpacesRes,
    snapshotsRes,
    weekNodesRes,
    weeklySessionRes,
    monthlySessionRes,
    recentNodesRes,
    lastCaptureRes,
    weekCountRes,
    commitmentCountRes,
    tensionCountRes,
    hunchCountRes,
    hunchStagesRes,
  ] = await Promise.all([
    supabase.from('profiles').select('name').eq('id', user.id).single(),
    supabase.from('tension_alerts' as string).select('id, title').eq('status', 'active').limit(4),
    supabase.from('nodes').select('id, title').eq('node_type', 'commitment')
      .neq('status', 'archived').neq('status', 'falsified').neq('status', 'suspended')
      .lt('updated_at', tenDaysAgo).limit(3),
    // Count nodes awaiting review — matches Health page logic exactly
    supabase.from('nodes').select('id', { count: 'exact', head: true })
      .eq('author_id', user.id)
      .or(`status.eq.flagged_for_review,and(status.eq.llm_reviewed,node_type.in.(${getKnowledgeReviewTypes().join(',')}))`),
    supabase.from('nodes').select('id, title').eq('node_type', 'goal_space').neq('status', 'archived'),
    supabase.from('convergence_snapshots' as string).select('goal_space_id, score, computed_at')
      .order('computed_at', { ascending: false }).limit(200),
    supabase.from('nodes').select('created_at').gte('created_at', weekStart.toISOString()),
    supabase.from('reflection_sessions' as string).select('id', { count: 'exact', head: true })
      .gte('created_at', weekStart.toISOString()),
    supabase.from('reflection_sessions' as string).select('id', { count: 'exact', head: true })
      .gte('created_at', monthStart),
    supabase.from('nodes').select('id, title, node_type, created_at')
      .neq('status', 'archived').order('created_at', { ascending: false }).limit(20),
    supabase.from('nodes').select('created_at').neq('status', 'archived')
      .order('created_at', { ascending: false }).limit(1),
    supabase.from('nodes').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
    supabase.from('nodes').select('id', { count: 'exact', head: true })
      .eq('node_type', 'commitment').neq('status', 'archived').neq('status', 'falsified'),
    supabase.from('tension_alerts' as string).select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('nodes').select('id', { count: 'exact', head: true })
      .eq('node_type', 'hunch').neq('status', 'archived').neq('status', 'falsified')
      .neq('status', 'suspended').neq('status', 'promoted'),
    supabase.from('nodes').select('lifecycle_stage')
      .eq('node_type', 'hunch').neq('status', 'archived').neq('status', 'falsified')
      .neq('status', 'suspended').neq('status', 'promoted'),
  ]);

  const focusItems: FocusItem[] = [];
  for (const t of (tensionsRes.data ?? [])) {
    focusItems.push({ id: `tension-${t.id}`, type: 'tension', title: String(t.title), subtitle: 'awaiting resolution', href: '/review' });
  }
  for (const c of (staleCommitmentsRes.data ?? [])) {
    focusItems.push({ id: `stale-${c.id}`, type: 'stale_commitment', title: String(c.title), subtitle: 'no activity in 10+ days', href: '/commitments' });
  }
  const unprocessedCount = unprocessedRes.count ?? 0;
  if (unprocessedCount > 0) {
    focusItems.push({ id: 'unprocessed', type: 'unprocessed_captures', title: `${unprocessedCount} capture${unprocessedCount === 1 ? '' : 's'} need processing`, subtitle: 'from the past 7 days', href: '/review' });
  }

  const stageCountsMutable = { hypothesis: 0, uncertainty: 0, navigation: 0, coherence: 0, holding: 0 };
  for (const row of (hunchStagesRes.data ?? [])) {
    const s = row.lifecycle_stage as string;
    if (s in stageCountsMutable) stageCountsMutable[s as keyof typeof stageCountsMutable]++;
  }
  const stageCounts: HunchStageCounts = stageCountsMutable;

  const pulse: SystemPulseData = {
    lastCaptureAt: (lastCaptureRes.data ?? [])[0]?.created_at ?? null,
    thisWeekCount: weekCountRes.count ?? 0,
    activeCommitmentsCount: commitmentCountRes.count ?? 0,
    openTensionsCount: tensionCountRes.count ?? 0,
    hunchesInFlightCount: hunchCountRes.count ?? 0,
    hunchStageCounts: stageCounts,
  };

  const goalSpaces = (allGoalSpacesRes.data ?? []) as { id: string; title: string }[];
  const snapshots = (snapshotsRes.data ?? []) as { goal_space_id: string; score: number; computed_at: string }[];
  const trajectoryItems = computeTrajectoryItems(goalSpaces, snapshots);

  const rhythm: RhythmData = {
    dailyCaptures: computeDailyCaptures(weekNodesRes.data ?? [], weekStart),
    weeklyReviewDone: (weeklySessionRes.count ?? 0) > 0,
    monthlyReflectionDone: (monthlySessionRes.count ?? 0) > 0,
    todayIndex: getTodayIndex(),
  };

  const activityGroups = groupByDate((recentNodesRes.data ?? []) as ActivityNode[]);
  const profileName = (profileRes.data as { name: string | null } | null)?.name ?? null;

  return (
    <div className="page-with-nav">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-baseline justify-between mb-8">
          <h1 className="text-xl font-semibold text-cof-text-primary">{greeting(profileName)}</h1>
          <p className="text-sm text-cof-text-tertiary">{todayLabel()}</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 space-y-4">
            <FocusToday items={focusItems} />
            <RecentActivity groups={activityGroups} />
          </div>
          <div className="lg:col-span-2 space-y-4">
            <SystemPulse data={pulse} />
            <Trajectory items={trajectoryItems} />
            <WeeklyRhythm rhythm={rhythm} />
          </div>
        </div>
      </div>
    </div>
  );
}
