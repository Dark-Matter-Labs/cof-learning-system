import { GraphOSSurface } from '@/components/graph/GraphOSSurface';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function GraphPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login');
  return <GraphOSSurface />;
}
