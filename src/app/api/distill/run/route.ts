import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { runDistillation } from '@/lib/agents/distillation';

// Clustering + one synthesis LLM call per group run sequentially; on a large
// graph this can exceed the default function timeout.
export const maxDuration = 300;

export async function POST(): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const result = await runDistillation(supabase, user.id);
    return NextResponse.json({ data: result });
  } catch {
    process.stderr.write('[distill/run] Unhandled error in runDistillation\n');
    return NextResponse.json({ error: 'Distillation failed' }, { status: 500 });
  }
}
