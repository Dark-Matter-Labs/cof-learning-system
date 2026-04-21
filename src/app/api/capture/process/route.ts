import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { runExtraction, runMeetingExtraction, type GoalContext } from '@/lib/agents/extraction';
import type { AttachmentContent } from '@/lib/agents/extraction';
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
      { data: personNodesData },
    ] = await Promise.all([
      supabase
        .from('nodes')
        .select('title, description, node_type, content, attachments')
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
      supabase
        .from('nodes')
        .select('id, title')
        .eq('node_type', 'person')
        .in('status', ['promoted', 'human_reviewed']),
    ]);

    if (fetchError || !node) {
      throw new Error(`Node not found: ${node_id}`);
    }

    const goalContext: GoalContext = {
      goalSpaces: goalSpacesData ?? [],
      triggerOutcomes: triggerOutcomesData ?? [],
      personNodes: personNodesData ?? [],
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

      // Read file attachment content if present
      let attachmentContent: AttachmentContent | undefined;
      const attachments = (node as unknown as { attachments?: Array<{ storage_path: string; mime_type: string }> }).attachments ?? [];

      if (attachments.length > 0) {
        const attachment = attachments[0];
        const adminClient = createAdminClient();
        const { data: fileData } = await adminClient.storage.from('attachments').download(attachment.storage_path);

        if (fileData) {
          const arrayBuffer = await fileData.arrayBuffer();

          if (attachment.mime_type === 'text/plain') {
            attachmentContent = { type: 'text', textContent: new TextDecoder().decode(arrayBuffer) };
          } else if (attachment.mime_type === 'application/pdf') {
            attachmentContent = { type: 'pdf', base64: Buffer.from(arrayBuffer).toString('base64') };
          } else if (attachment.mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const mammoth = await import('mammoth');
            const result = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) });
            attachmentContent = { type: 'text', textContent: result.value };
          }
        }
      }

      const extraction = await runExtraction(node.title, node.description ?? '', goalContext, attachmentContent);

      // Determine node_type and confidence from extraction
      const classifiedNodeType = extraction.node_type ?? node.node_type;
      const confidenceLevel = extraction.confidence_assessment.level;
      const confidenceBasis = extraction.confidence_assessment.basis;

      // Determine status from maturity
      const maturity = extraction.maturity;
      const newStatus = maturity === 'ready_to_promote' ? 'promoted' : 'flagged_for_review';

      const titleUpdate = node.title === '' ? { title: extraction.title } : {};

      // Update node with extraction results, classified type, and new status
      await supabase
        .from('nodes')
        .update({
          ...titleUpdate,
          llm_extraction: extraction,
          status: newStatus,
          node_type: classifiedNodeType,
          confidence_level: confidenceLevel,
          confidence_basis: confidenceBasis,
          content: {
            ...((node.content as Record<string, unknown>) ?? {}),
            maturity,
            process_status: newStatus,
          },
        })
        .eq('id', node_id);

      // Log activity
      await supabase.from('activity_log').insert({
        actor_id: user.id,
        action: 'reviewed',
        target_node_id: node_id,
        details: { type: 'llm_extraction', model: 'extraction', classified_type: classifiedNodeType, maturity },
      });

      return NextResponse.json({ data: { node_id, status: newStatus, node_type: classifiedNodeType, maturity } });
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
