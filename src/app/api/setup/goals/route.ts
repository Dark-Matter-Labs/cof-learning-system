import { withAuth } from '@/lib/api/withAuth';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  goals: z.array(z.object({ title: z.string().min(1), description: z.string().optional() })).min(1),
});

export const POST = withAuth(async ({ request, user, supabase }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'At least one goal required' }, { status: 400 });

  const nodes = parsed.data.goals.map(g => ({
    node_type: 'goal_space',
    title: g.title,
    description: g.description ?? null,
    status: 'promoted',
    confidence_level: 3,
    confidence_basis: 'intuition',
    hunch_type: 'new',
    author_id: user.id,
  }));

  const { data, error } = await supabase.from('nodes').insert(nodes).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
});
