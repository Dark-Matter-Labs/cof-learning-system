import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ReflectClient } from './ReflectClient';
import type { FilterOption } from '@/lib/types/filter';

export const dynamic = 'force-dynamic';

export default async function ReflectPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login');

  const [sitesRes, optionsRes, goalSpacesRes] = await Promise.all([
    supabase
      .from('nodes')
      .select('id, title')
      .eq('node_type', 'site')
      .neq('status', 'archived'),
    supabase
      .from('nodes')
      .select('id, title')
      .eq('node_type', 'option')
      .in('status', ['promoted', 'human_reviewed']),
    supabase
      .from('nodes')
      .select('id, title')
      .eq('node_type', 'goal_space')
      .neq('status', 'archived'),
  ]);

  const sites: FilterOption[] = (sitesRes.data ?? []).map(n => ({ id: n.id as string, label: n.title as string, type: 'site' }));
  const options: FilterOption[] = (optionsRes.data ?? []).map(n => ({ id: n.id as string, label: n.title as string, type: 'option' }));
  const goalSpaces: FilterOption[] = (goalSpacesRes.data ?? []).map(n => ({ id: n.id as string, label: n.title as string, type: 'goal_space' }));

  return (
    <div className="page-with-nav">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-6">Reflection</h1>
        <ReflectClient sites={sites} options={options} goalSpaces={goalSpaces} />
      </div>
    </div>
  );
}
