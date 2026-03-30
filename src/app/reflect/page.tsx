import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ReflectClient } from './ReflectClient';
import type { GoalSpaceInfo, ReflectionSession } from './types';

export default async function ReflectPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login');

  const { data: goalSpaces } = await supabase
    .from('nodes')
    .select('id, title')
    .eq('node_type', 'goal_space')
    .neq('status', 'archived');

  const { data: lastSession } = await supabase
    .from('reflection_sessions')
    .select('id, machine_reflection, human_responses, decisions, convergence_snapshot, participants, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Reflection Session</h1>
      <ReflectClient
        goalSpaces={(goalSpaces ?? []) as GoalSpaceInfo[]}
        lastSession={lastSession as ReflectionSession | null}
        userId={user.id}
      />
    </div>
  );
}
