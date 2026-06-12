import { withAuth } from '@/lib/api/withAuth';
import { NextResponse, after } from 'next/server';
import { isOwnedStoragePath } from '@/lib/files/storagePath';

export const POST = withAuth(async ({ request, user, supabase }) => {
  const body = await request.json();
  const {
    title,
    node_type = 'hunch',
    description,
    hunch_type,
    confidence_level,
    external_link,
    content,
    insight_date,
    participant_ids,
    attachment,
  } = body;

  const hasAttachment = attachment && typeof attachment.storage_path === 'string';
  // The capture → process pipeline later downloads this path with the
  // service-role client (bypassing storage RLS), so reject any path the caller
  // doesn't own before it is persisted.
  if (hasAttachment && !isOwnedStoragePath(attachment.storage_path, user.id)) {
    return NextResponse.json({ error: 'Invalid attachment path' }, { status: 403 });
  }
  if (!hasAttachment && (!title || typeof title !== 'string' || title.trim().length === 0)) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  const externalLinks = external_link?.url
    ? [{ url: external_link.url, label: external_link.label || external_link.url, added_at: new Date().toISOString() }]
    : [];

  const { data: node, error } = await supabase
    .from('nodes')
    .insert({
      node_type,
      title: title?.trim() || '',
      description: description?.trim() || null,
      hunch_type: hunch_type || 'new',
      confidence_level: confidence_level || 3,
      confidence_basis: 'intuition',
      status: 'raw',
      author_id: user.id,
      external_links: externalLinks,
      content: content ?? null,
      insight_date: insight_date ?? null,
      attachments: attachment ? [attachment] : [],
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from('activity_log').insert({
    actor_id: user.id,
    action: 'created_hunch',
    target_node_id: node.id,
    details: { title: node.title, hunch_type: node.hunch_type },
  });

  if (participant_ids && Array.isArray(participant_ids) && participant_ids.length > 0) {
    const participantEdges = (participant_ids as string[]).map((personId: string) => ({
      source_id: node.id,
      target_id: personId,
      edge_type: 'participated_in',
      weight: 1,
      author_id: user.id,
    }));
    await supabase.from('edges').insert(participantEdges);
  }

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

  const processUrl = new URL('/api/capture/process', request.url).toString();
  const processCookie = request.headers.get('cookie') ?? '';
  const processBody = JSON.stringify({ node_id: node.id });
  after(async () => {
    await fetch(processUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': processCookie },
      body: processBody,
    }).catch(() => {});
  });

  return NextResponse.json({ data: node }, { status: 201 });
});
