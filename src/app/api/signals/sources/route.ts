import { withAuth } from '@/lib/api/withAuth';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const createSchema = z.object({
  source_type: z.enum(['web', 'slack', 'drive', 'notion']),
  topic_node_id: z.string().uuid(),
  config: z.record(z.string(), z.unknown()),
});

export const GET = withAuth(async ({ user, supabase }) => {
  const { data, error } = await supabase
    .from('auto_signal_sources')
    .select('id, source_type, topic_node_id, config, enabled, last_run_at, created_at')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Failed to load sources' }, { status: 500 });
  return NextResponse.json({ data });
});

export const POST = withAuth(async ({ user, supabase, request }) => {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const { data, error } = await supabase.from('auto_signal_sources').insert({
    ...parsed.data,
    created_by: user.id,
  }).select().single();

  if (error) return NextResponse.json({ error: 'Failed to create source' }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
});

export const PATCH = withAuth(async ({ user, supabase, request }) => {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = z.object({ id: z.string().uuid(), enabled: z.boolean() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const { id, enabled } = parsed.data;

  const { data, error } = await supabase.from('auto_signal_sources')
    .update({ enabled })
    .eq('id', id)
    .eq('created_by', user.id)
    .select().single();

  if (error) return NextResponse.json({ error: 'Failed to update source' }, { status: 500 });
  return NextResponse.json({ data });
});
