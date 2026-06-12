import { withAuth } from '@/lib/api/withAuth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { processSeedChat } from '@/lib/agents/setup';

const ALLOWED_SEED_NODE_TYPES = new Set([
  'hunch',
  'assumption_background',
  'assumption_foreground',
  'learning',
  'signal',
]);

const chatSchema = z.object({
  mode: z.literal('chat'),
  message: z.string().min(1),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })),
  goals: z.array(z.object({ title: z.string() })),
});

const writeSchema = z.object({
  mode: z.literal('write'),
  content: z.string().min(1),
  goals: z.array(z.object({ title: z.string() })),
});

export const POST = withAuth(async ({ request, user, supabase }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if ((body as { mode?: string }).mode === 'chat') {
    const parsed = chatSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

    let result: Awaited<ReturnType<typeof processSeedChat>>;
    try {
      result = await processSeedChat(parsed.data);
    } catch {
      return NextResponse.json({ error: 'Failed to process message' }, { status: 500 });
    }

    if (result.extracted.length > 0) {
      const nodes = result.extracted
        .filter(e => ALLOWED_SEED_NODE_TYPES.has(e.node_type))
        .map(e => ({
          node_type: e.node_type,
          title: e.title,
          status: 'promoted',
          confidence_level: 2,
          confidence_basis: 'intuition',
          hunch_type: 'new',
          author_id: user.id,
        }));
      if (nodes.length > 0) {
        const { error: insertError } = await supabase.from('nodes').insert(nodes);
        if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ reply: result.reply, extracted: result.extracted }, { status: 200 });
  }

  if ((body as { mode?: string }).mode === 'write') {
    const parsed = writeSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

    const { data: node, error } = await supabase
      .from('nodes')
      .insert({
        node_type: 'hunch',
        title: 'Initial assumptions',
        description: parsed.data.content,
        status: 'raw',
        confidence_level: 2,
        confidence_basis: 'intuition',
        hunch_type: 'new',
        author_id: user.id,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Trigger async extraction (fire-and-forget)
    const processUrl = new URL('/api/capture/process', request.url);
    fetch(processUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') ?? '',
      },
      body: JSON.stringify({ node_id: node.id }),
    }).catch(() => {});

    return NextResponse.json({ node_id: node.id }, { status: 200 });
  }

  return NextResponse.json({ error: 'Invalid mode. Expected chat or write.' }, { status: 400 });
});
