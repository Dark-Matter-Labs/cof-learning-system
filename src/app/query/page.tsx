import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { QueryClient } from './QueryClient';
import type { Node } from '@/lib/types/nodes';

export default async function QueryPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login');

  const { data: nodesData, error: nodesError } = await supabase
    .from('nodes')
    .select('id, node_type, title, description, status')
    .neq('status', 'archived');

  if (nodesError) {
    throw new Error('Failed to load graph data');
  }

  const nodes = (nodesData ?? []) as Pick<Node, 'id' | 'node_type' | 'title' | 'description' | 'status'>[];

  return <QueryClient nodes={nodes} />;
}
