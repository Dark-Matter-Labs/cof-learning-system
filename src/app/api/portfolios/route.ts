import { NextResponse } from 'next/server';
import { z } from 'zod';
import { STEP_NAMES } from '@/lib/portfolio/agents';
import { withAuth } from '@/lib/api/withAuth';

const createSchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().max(300).optional(),
  description: z.string().max(2000).optional(),
});

export const GET = withAuth(async ({ user, supabase }) => {
  const { data, error } = await supabase
    .from('portfolios')
    .select('id, title, subtitle, status, current_step, created_at, updated_at')
    .eq('author_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Failed to load portfolios' }, { status: 500 });

  return NextResponse.json({ data: data ?? [] });
});

export const POST = withAuth(async ({ user, supabase, request }) => {
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const { title, subtitle, description } = parsed.data;

  const { data: portfolio, error: insertError } = await supabase
    .from('portfolios')
    .insert({ title, subtitle, description, author_id: user.id })
    .select('id')
    .single();

  if (insertError || !portfolio) {
    return NextResponse.json({ error: 'Failed to create portfolio' }, { status: 500 });
  }

  const stepRows = Object.entries(STEP_NAMES).map(([num, name]) => ({
    portfolio_id: portfolio.id,
    step_number: Number(num),
    step_name: name,
  }));

  const { error: stepsError } = await supabase.from('portfolio_steps').insert(stepRows);
  if (stepsError) {
    await supabase.from('portfolios').delete().eq('id', portfolio.id);
    return NextResponse.json({ error: 'Failed to initialise steps' }, { status: 500 });
  }

  return NextResponse.json({ data: { id: portfolio.id } }, { status: 201 });
});
