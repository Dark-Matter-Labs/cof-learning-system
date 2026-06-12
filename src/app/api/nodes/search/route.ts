import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';

export const GET = withAuth(async ({ supabase, request }) => {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const type = searchParams.get('type');

  if (!q || q.trim().length === 0) {
    return NextResponse.json({ error: 'Query parameter q is required' }, { status: 400 });
  }

  let query = supabase
    .from('nodes')
    .select('id, title, node_type')
    .ilike('title', `%${q.trim()}%`)
    .in('status', ['promoted', 'human_reviewed'])
    .limit(10);

  if (type) {
    query = query.eq('node_type', type);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
});
