import { createClient } from '@/lib/supabase/server';
import { runExtraction, runMeetingExtraction, type GoalContext } from '@/lib/agents/extraction';
import { getCaptureType } from '@/lib/config/captureTypes';
import type { MeetingExtraction } from '@/lib/types/nodes';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { node_id } = await request.json();

  if (!node_id) {
    return NextResponse.json({ error: 'node_id is required' }, { status: 400 });
  }

  // Set status to processing
  await supabase
    .from('nodes')
    .update({ status: 'processing' })
    .eq('id', node_id);

  try {
    // Fetch the node and goal context in parallel
    const [
      { data: node, error: fetchError },
      { data: goalSpacesData },
      { data: triggerOutcomesData },
    ] = await Promise.all([
      supabase
        .from('nodes')
        .select('title, description, node_type, content')
        .eq('id', node_id)
        .single(),
      supabase
        .from('nodes')
        .select('id, title')
        .eq('node_type', 'goal_space')
        .neq('status', 'archived'),
      supabase
        .from('nodes')
        .select('id, title')
        .eq('node_type', 'trigger_outcome')
        .neq('status', 'archived'),
    ]);

    if (fetchError || !node) {
      throw new Error(`Node not found: ${node_id}`);
    }

    const goalContext: GoalContext = {
      goalSpaces: goalSpacesData ?? [],
      triggerOutcomes: triggerOutcomesData ?? [],
    };

    const captureConfig = getCaptureType(node.node_type as Parameters<typeof getCaptureType>[0]);

    if (captureConfig?.multiNodeExtraction) {
      // Multi-node extraction path (meeting notes)
      const contentObj = (node.content ?? {}) as Record<string, unknown>;
      const meetingDate = contentObj.meeting_date as string | undefined;
      const participants = contentObj.participants as string[] | undefined;

      const meetingExtraction: MeetingExtraction = await runMeetingExtraction(
        node.title,
        node.description ?? '',
        meetingDate,
        participants,
        goalContext,
      );

      // Store meeting extraction on parent node
      await supabase
        .from('nodes')
        .update({
          llm_extraction: meetingExtraction as unknown as Record<string, unknown>,
          status: 'llm_reviewed',
        })
        .eq('id', node_id);

      // Create child nodes for each extracted node
      const childInserts = meetingExtraction.extracted_nodes.map(extracted => ({
        node_type: extracted.node_type,
        title: extracted.title,
        description: extracted.summary,
        confidence_level: extracted.confidence_level,
        confidence_basis: 'observation' as const,
        status: 'llm_reviewed' as const,
        author_id: user.id,
        parent_node_id: node_id,
        domain_tags: extracted.domain_tags,
        content: { category: extracted.category, rationale: extracted.rationale, source_meeting: node_id },
        llm_extraction: {
          title: extracted.title,
          summary: extracted.summary,
          entities: [],
          domain_tags: extracted.domain_tags,
          suggested_connections: [],
          confidence_assessment: { level: extracted.confidence_level, basis: 'observation' },
          open_questions: [],
          structured_claim: null,
          assumption_type: null,
          commitment_relevance: null,
        },
      }));

      if (childInserts.length > 0) {
        await supabase.from('nodes').insert(childInserts);
      }

      // Log activity
      await supabase.from('activity_log').insert({
        actor_id: user.id,
        action: 'reviewed',
        target_node_id: node_id,
        details: { type: 'meeting_extraction', model: 'extraction', child_count: childInserts.length },
      });

      return NextResponse.json({
        data: { node_id, status: 'llm_reviewed', child_count: childInserts.length },
      });
    } else {
      // Single-node extraction path
      const extraction = await runExtraction(node.title, node.description ?? '', goalContext);

      // Update node with extraction results
      await supabase
        .from('nodes')
        .update({
          llm_extraction: extraction,
          status: 'llm_reviewed',
        })
        .eq('id', node_id);

      // Log activity
      await supabase.from('activity_log').insert({
        actor_id: user.id,
        action: 'reviewed',
        target_node_id: node_id,
        details: { type: 'llm_extraction', model: 'extraction' },
      });

      return NextResponse.json({ data: { node_id, status: 'llm_reviewed' } });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Set error status
    await supabase
      .from('nodes')
      .update({
        status: 'error',
        llm_extraction: { error: errorMessage, failed_at: new Date().toISOString() },
      })
      .eq('id', node_id);

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
