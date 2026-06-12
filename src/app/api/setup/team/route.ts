import { withAuth } from '@/lib/api/withAuth';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  members: z.array(z.object({ name: z.string().min(1), role: z.string().optional() })).min(1),
});

export const POST = withAuth(async ({ request, user, supabase }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'At least one member required' }, { status: 400 });

  const nodes = parsed.data.members.map(m => ({
    node_type: 'person',
    title: m.name,
    description: m.role ?? null,
    status: 'promoted',
    confidence_level: 5,
    confidence_basis: 'strong_evidence',
    hunch_type: 'new',
    author_id: user.id,
  }));

  const { data, error } = await supabase.from('nodes').insert(nodes).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
});
