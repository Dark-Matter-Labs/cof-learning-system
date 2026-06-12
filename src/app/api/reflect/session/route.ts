import { withAuth } from '@/lib/api/withAuth';
import { NextResponse } from 'next/server';
import type { ReflectionSessionPayload } from '@/app/reflect/types';

export const POST = withAuth(async ({ user, supabase, request }) => {
  try {
    const body: ReflectionSessionPayload = await request.json();

    // Validate required fields
    if (!body.human_responses || typeof body.human_responses !== 'object') {
      return NextResponse.json({ error: 'human_responses required' }, { status: 400 });
    }
    if (!Array.isArray(body.decisions)) {
      return NextResponse.json({ error: 'decisions must be an array' }, { status: 400 });
    }

    const { data: session, error: insertError } = await supabase.from('reflection_sessions').insert({
      machine_reflection: body.machine_reflection ?? {},
      human_responses: body.human_responses,
      decisions: body.decisions,
      convergence_snapshot: body.convergence_snapshot ?? {},
      participants: body.participants ?? [user.id],
      node_count_at_reflection: body.node_count_at_reflection ?? 0,
      triggered_by: 'on_demand',
      run_by: user.id,
    }).select('id').single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: (session as { id: string }).id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
