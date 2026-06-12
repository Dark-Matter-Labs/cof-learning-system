import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/withAuth';

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  subtitle: z.string().max(300).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['in_progress', 'complete', 'paused', 'archived']).optional(),
});

export const GET = withAuth<{ id: string }>(async ({ user, supabase, params }) => {
  const { id } = await params;

  const { data: portfolio, error } = await supabase
    .from('portfolios')
    .select('*')
    .eq('id', id)
    .eq('author_id', user.id)
    .single();

  if (error || !portfolio) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: steps } = await supabase
    .from('portfolio_steps')
    .select('*')
    .eq('portfolio_id', id)
    .order('step_number', { ascending: true });

  return NextResponse.json({ data: { ...portfolio, steps: steps ?? [] } });
});

export const PATCH = withAuth<{ id: string }>(async ({ user, supabase, request, params }) => {
  const { id } = await params;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const { data, error } = await supabase
    .from('portfolios')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('author_id', user.id)
    .select()
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found or update failed' }, { status: 404 });

  return NextResponse.json({ data });
});
