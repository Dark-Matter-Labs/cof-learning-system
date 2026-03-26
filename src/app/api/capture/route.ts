import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { title, node_type = 'hunch', description, hunch_type, confidence_level, external_link, content } = body;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  const externalLinks = external_link?.url
    ? [{ url: external_link.url, label: external_link.label || external_link.url, added_at: new Date().toISOString() }]
    : [];

  const { data: node, error } = await supabase
    .from('nodes')
    .insert({
      node_type,
      title: title.trim(),
      description: description?.trim() || null,
      hunch_type: hunch_type || 'new',
      confidence_level: confidence_level || 3,
      confidence_basis: 'intuition',
      status: 'raw',
      author_id: user.id,
      external_links: externalLinks,
      content: content ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log activity
  await supabase.from('activity_log').insert({
    actor_id: user.id,
    action: 'created_hunch',
    target_node_id: node.id,
    details: { title: node.title, hunch_type: node.hunch_type },
  });

  // Fire-and-forget: propagate signal if this is a signal node
  if (node_type === 'signal') {
    const signalUrl = new URL('/api/signals', request.url);
    fetch(signalUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') ?? '',
      },
      body: JSON.stringify({ node_id: node.id }),
    }).catch(() => {});
  }

  // Fire-and-forget: trigger LLM extraction
  const processUrl = new URL('/api/capture/process', request.url);
  fetch(processUrl.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': request.headers.get('cookie') ?? '',
    },
    body: JSON.stringify({ node_id: node.id }),
  }).catch(() => {
    // Fire-and-forget — errors handled by the process route
  });

  return NextResponse.json({ data: node }, { status: 201 });
}
