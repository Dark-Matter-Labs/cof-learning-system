import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { propagateSignal } from '@/lib/signals/propagate';

export const POST = withAuth(async ({ request }) => {
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
});
