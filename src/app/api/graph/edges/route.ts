import { createClient } from '@/lib/supabase/server';
import { withAuth } from '@/lib/api/withAuth';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('edges')
    .select('*');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export const POST = withAuth(async ({ request, user, supabase }) => {
  const body = await request.json();
  const { data, error } = await supabase
    .from('edges')
    .insert({ ...body, author_id: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('activity_log').insert({
    actor_id: user.id,
    action: 'connected',
    target_node_id: body.source_id,
    details: { edge_type: body.edge_type, target_id: body.target_id },
  });

  return NextResponse.json({ data }, { status: 201 });
});
