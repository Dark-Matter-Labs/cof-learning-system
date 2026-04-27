import { GraphOSSurface } from '@/components/graph/GraphOSSurface';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: goalSpaces } = await supabase
      .from('nodes')
      .select('id')
      .eq('node_type', 'goal_space')
      .neq('status', 'archived')
      .limit(1);

    if (!goalSpaces || goalSpaces.length === 0) {
      redirect('/setup');
    }
  }

  return <GraphOSSurface />;
}
