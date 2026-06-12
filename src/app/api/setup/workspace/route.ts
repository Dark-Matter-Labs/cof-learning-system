import { withAuth } from '@/lib/api/withAuth';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export const POST = withAuth(async ({ request, user, supabase }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const { data, error } = await supabase
    .from('contexts')
    .insert({ name: parsed.data.name, description: parsed.data.description ?? null, created_by: user.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
});
