import { withAuth } from '@/lib/api/withAuth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { suggestGoal } from '@/lib/agents/setup';

const schema = z.object({ input: z.string().min(1) });

export const POST = withAuth(async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Input is required' }, { status: 400 });

  try {
    const suggestion = await suggestGoal(parsed.data.input);
    return NextResponse.json({ data: suggestion }, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Failed to generate suggestion' }, { status: 500 });
  }
});
