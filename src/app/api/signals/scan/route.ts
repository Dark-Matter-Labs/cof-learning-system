import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { scanWebForTopics } from '@/lib/signals/webScanner';

// Web search + relevance filtering + per-topic LLM extraction; can exceed the
// default function timeout.
export const maxDuration = 300;

export async function POST(): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await scanWebForTopics(user.id);
  return NextResponse.json({ data: result });
}
