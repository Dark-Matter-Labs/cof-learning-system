import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { callLLM } from '@/lib/llm';
import { selectMissionPathwaysNodes, selectCloseContactsNodes } from '@/lib/newsletter/select';
import {
  MISSION_PATHWAYS_PROMPT,
  CLOSE_CONTACTS_PROMPT,
  buildMissionPathwaysMessage,
  buildCloseContactsMessage,
} from '@/lib/newsletter/agents';

const typeSchema = z.enum(['mission_pathways', 'close_contacts']);
const postSchema = z.object({ type: typeSchema });

export async function GET(request: Request): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const typeResult = typeSchema.safeParse(searchParams.get('type'));
  if (!typeResult.success) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

  const { data, error } = await supabase
    .from('newsletters')
    .select('id, type, content, created_at')
    .eq('author_id', user.id)
    .eq('type', typeResult.data)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: 'Failed to load newsletters' }, { status: 500 });

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const { type } = parsed.data;

  let userMessage: string;
  let systemPrompt: string;
  let llmResponse: { content: string };

  try {
    if (type === 'mission_pathways') {
      const nodeData = await selectMissionPathwaysNodes(supabase);
      userMessage = buildMissionPathwaysMessage(nodeData);
      systemPrompt = MISSION_PATHWAYS_PROMPT;
    } else {
      const nodeData = await selectCloseContactsNodes(supabase);
      userMessage = buildCloseContactsMessage(nodeData);
      systemPrompt = CLOSE_CONTACTS_PROMPT;
    }
    llmResponse = await callLLM('newsletter', { systemPrompt, userMessage, maxTokens: 800 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { data: newsletter, error: insertError } = await supabase
    .from('newsletters')
    .insert({ type, content: llmResponse.content, author_id: user.id })
    .select('id, type, content, created_at')
    .single();

  if (insertError || !newsletter) {
    return NextResponse.json({ error: 'Failed to save newsletter' }, { status: 500 });
  }

  return NextResponse.json({ data: newsletter }, { status: 201 });
}
