import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { propagateSignal } from '@/lib/signals/propagate';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || !('node_id' in body) || typeof (body as Record<string, unknown>).node_id !== 'string') {
    return NextResponse.json({ success: false, error: 'node_id is required' }, { status: 400 });
  }

  const { node_id } = body as { node_id: string };

  try {
    await propagateSignal(node_id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Propagation failed' },
      { status: 500 }
    );
  }
}
