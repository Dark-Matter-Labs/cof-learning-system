import { withAuth } from '@/lib/api/withAuth';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  sites: z.array(z.object({ name: z.string().min(1), description: z.string().optional() })),
  options: z.array(z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    goal_id: z.string().uuid().optional(),
  })),
});

export const POST = withAuth(async ({ request, user, supabase }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { sites, options } = parsed.data;
  let createdCount = 0;

  if (sites.length > 0) {
    const siteNodes = sites.map(s => ({
      node_type: 'site',
      title: s.name,
      description: s.description ?? null,
      status: 'promoted',
      confidence_level: 5,
      confidence_basis: 'strong_evidence',
      hunch_type: 'new',
      author_id: user.id,
    }));
    const { data, error } = await supabase.from('nodes').insert(siteNodes).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    createdCount += (data ?? []).length;
  }

  if (options.length > 0) {
    const optionNodes = options.map(o => ({
      node_type: 'option',
      title: o.name,
      description: o.description ?? null,
      status: 'promoted',
      confidence_level: 3,
      confidence_basis: 'intuition',
      hunch_type: 'new',
      author_id: user.id,
    }));
    const { data, error } = await supabase.from('nodes').insert(optionNodes).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const optionData = data ?? [];
    createdCount += optionData.length;

    const edges = optionData
      .map((optNode: { id: string }, idx: number) => {
        const goalId = options[idx]?.goal_id;
        if (!goalId) return null;
        return {
          source_id: optNode.id,
          target_id: goalId,
          edge_type: 'belongs_to_goalspace',
          weight: 1,
          author_id: user.id,
        };
      })
      .filter(Boolean);

    if (edges.length > 0) {
      const { error: edgeError } = await supabase.from('edges').insert(edges);
      if (edgeError) return NextResponse.json({ error: edgeError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ data: { created: createdCount } }, { status: 201 });
});
