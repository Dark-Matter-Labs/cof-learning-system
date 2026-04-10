import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NodeStatus, ConfidenceBasis } from '@/lib/types/nodes';

const ALLOWED_STATUSES: readonly NodeStatus[] = ['promoted', 'archived', 'falsified', 'suspended'];

const ALLOWED_CONFIDENCE_BASES: readonly ConfidenceBasis[] = [
  'intuition',
  'analogy',
  'observation',
  'early_evidence',
  'strong_evidence',
];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Whitelist updatable fields
  const update: Record<string, unknown> = {};

  if ('title' in body) {
    if (typeof body.title !== 'string' || body.title.trim().length === 0) {
      return NextResponse.json({ error: 'title must be a non-empty string' }, { status: 400 });
    }
    update.title = body.title.trim();
  }

  if ('description' in body) {
    if (body.description !== null && typeof body.description !== 'string') {
      return NextResponse.json({ error: 'description must be a string or null' }, { status: 400 });
    }
    update.description = body.description;
  }

  if ('node_type' in body) {
    if (typeof body.node_type !== 'string' || body.node_type.trim().length === 0) {
      return NextResponse.json({ error: 'node_type must be a non-empty string' }, { status: 400 });
    }
    update.node_type = body.node_type.trim();
  }

  if ('confidence_level' in body) {
    if (body.confidence_level !== null && (typeof body.confidence_level !== 'number' || body.confidence_level < 1 || body.confidence_level > 5)) {
      return NextResponse.json({ error: 'confidence_level must be 1-5 or null' }, { status: 400 });
    }
    update.confidence_level = body.confidence_level;
  }

  if ('confidence_basis' in body) {
    if (body.confidence_basis !== null && !ALLOWED_CONFIDENCE_BASES.includes(body.confidence_basis as ConfidenceBasis)) {
      return NextResponse.json({ error: `confidence_basis must be one of: ${ALLOWED_CONFIDENCE_BASES.join(', ')}` }, { status: 400 });
    }
    update.confidence_basis = body.confidence_basis;
  }

  if ('status' in body) {
    if (!ALLOWED_STATUSES.includes(body.status as NodeStatus)) {
      return NextResponse.json(
        { error: `status must be one of: ${ALLOWED_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }
    update.status = body.status;
  }

  if ('domain_tags' in body) {
    if (!Array.isArray(body.domain_tags) || !body.domain_tags.every(t => typeof t === 'string')) {
      return NextResponse.json({ error: 'domain_tags must be an array of strings' }, { status: 400 });
    }
    update.domain_tags = body.domain_tags;
  }

  if ('content' in body) {
    if (body.content !== null && (typeof body.content !== 'object' || Array.isArray(body.content))) {
      return NextResponse.json({ error: 'content must be an object or null' }, { status: 400 });
    }
    update.content = body.content;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('nodes')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
