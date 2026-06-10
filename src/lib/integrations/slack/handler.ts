/**
 * Slack event handler — business logic layer.
 *
 * Dispatches on Slack payload type:
 *   - slash_command     → opens the capture modal
 *   - message_action    → opens the capture modal pre-filled from the message
 *   - view_submission   → processes the submitted modal, writes the node
 */

import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildCaptureModal, parseCaptureModalValues } from './modal';

/** Maximum characters to use from a Slack message as the modal title pre-fill. */
const MAX_TITLE_PREFILL_LENGTH = 150;

// ─── Slack API helpers ───────────────────────────────────────────────────────

async function slackApiCall(
  method: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; error?: string; [key: string]: unknown }> {
  const botToken = process.env.SLACK_BOT_TOKEN;
  if (!botToken) {
    throw new Error('SLACK_BOT_TOKEN is not configured');
  }

  const res = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Bearer ${botToken}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as { ok: boolean; error?: string; [key: string]: unknown };
  return data;
}

// ─── Slash command ───────────────────────────────────────────────────────────

/** Parses an application/x-www-form-urlencoded slash command body. */
export interface SlashCommandPayload {
  readonly command: string;
  readonly text: string;
  readonly trigger_id: string;
  readonly user_id: string;
  readonly user_name: string;
  readonly team_id: string;
  readonly channel_id: string;
}

export async function handleSlashCommand(
  params: URLSearchParams
): Promise<NextResponse> {
  const triggerId = params.get('trigger_id');
  if (!triggerId) {
    return NextResponse.json({ error: 'Missing trigger_id' }, { status: 400 });
  }

  const modal = buildCaptureModal();
  const result = await slackApiCall('views.open', {
    trigger_id: triggerId,
    view: modal,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: `Failed to open modal: ${result.error ?? 'unknown'}` },
      { status: 500 }
    );
  }

  // Acknowledge the slash command immediately (empty 200 is fine)
  return new NextResponse(null, { status: 200 });
}

// ─── Message shortcut ────────────────────────────────────────────────────────

export interface MessageActionPayload {
  readonly type: 'message_action';
  readonly callback_id: string;
  readonly trigger_id: string;
  readonly user: { id: string; name: string };
  readonly team: { id: string; name: string };
  readonly channel: { id: string };
  readonly message: {
    readonly ts: string;
    readonly text?: string;
    readonly permalink?: string;
  };
}

export async function handleMessageAction(
  payload: MessageActionPayload
): Promise<NextResponse> {
  const rawText = payload.message.text ?? '';
  const titlePrefill = rawText.slice(0, MAX_TITLE_PREFILL_LENGTH).trim();

  // Fetch permalink if not included in the payload
  let permalink = payload.message.permalink;
  if (!permalink) {
    const permaResult = await slackApiCall('chat.getPermalink', {
      channel: payload.channel.id,
      message_ts: payload.message.ts,
    });
    if (permaResult.ok && typeof permaResult.permalink === 'string') {
      permalink = permaResult.permalink;
    }
  }

  const modal = buildCaptureModal({
    title: titlePrefill,
    sourceUrl: permalink,
  });

  const result = await slackApiCall('views.open', {
    trigger_id: payload.trigger_id,
    view: modal,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: `Failed to open modal: ${result.error ?? 'unknown'}` },
      { status: 500 }
    );
  }

  return new NextResponse(null, { status: 200 });
}

// ─── Modal submission ────────────────────────────────────────────────────────

export interface ViewSubmissionPayload {
  readonly type: 'view_submission';
  readonly user: { id: string; name: string };
  readonly team: { id: string };
  readonly view: {
    readonly callback_id: string;
    readonly private_metadata?: string;
    readonly state: {
      readonly values: Record<
        string,
        Record<string, { value?: string; selected_option?: { value: string } }>
      >;
    };
  };
}

/** Metadata stored in view.private_metadata (JSON string) */
interface PrivateMetadata {
  readonly channelId?: string;
  readonly messageTs?: string;
  readonly userId?: string;
  readonly responseUrl?: string;
}

export async function handleViewSubmission(
  payload: ViewSubmissionPayload,
  requestUrl: string
): Promise<NextResponse> {
  if (payload.view.callback_id !== 'cof_capture_modal') {
    // Not our modal — ignore
    return NextResponse.json({ response_action: 'clear' });
  }

  const { title, description, nodeType, sourceUrl } =
    parseCaptureModalValues(payload.view.state.values);

  if (!title) {
    return NextResponse.json({
      response_action: 'errors',
      errors: { title_block: 'Title is required' },
    });
  }

  let metadata: PrivateMetadata = {};
  try {
    if (payload.view.private_metadata) {
      metadata = JSON.parse(payload.view.private_metadata) as PrivateMetadata;
    }
  } catch {
    // ignore malformed metadata
  }

  const teamId = payload.team.id;
  const slackUserId = payload.user.id;

  // Build source_ref: stable identifier for this capture event
  // For message shortcuts: slack:{teamId}:{channelId}:{messageTs}
  // For slash commands without message context: slack:{teamId}:{slackUserId}:{Date.now()}
  const sourceRef = metadata.channelId && metadata.messageTs
    ? `slack:${teamId}:${metadata.channelId}:${metadata.messageTs}`
    : `slack:${teamId}:${slackUserId}:${Date.now()}`;

  const externalLinks = sourceUrl
    ? [{ url: sourceUrl, label: sourceUrl, added_at: new Date().toISOString() }]
    : [];

  // Use admin client: this handler runs outside a user browser session.
  // The Slack user identity is mapped via source metadata, not Supabase auth.
  // For now we write without author_id; a future enhancement maps Slack user
  // to Supabase user via a slack_user_id column on profiles.
  const supabase = createAdminClient();

  const { data: node, error } = await supabase
    .from('nodes')
    .insert({
      node_type: nodeType,
      title: title.trim(),
      description: description?.trim() ?? null,
      hunch_type: 'new',
      confidence_level: 3,
      confidence_basis: 'intuition',
      status: 'raw',
      author_id: null,  // TODO: map slack_user_id → Supabase user
      external_links: externalLinks,
      source: 'slack',
      source_ref: sourceRef,
      source_payload: {
        slack_user_id: slackUserId,
        slack_user_name: payload.user.name,
        team_id: teamId,
        channel_id: metadata.channelId ?? null,
        message_ts: metadata.messageTs ?? null,
      },
    })
    .select()
    .single();

  if (error) {
    // Duplicate: already captured this source_ref
    if (error.code === '23505') {
      return NextResponse.json({
        response_action: 'clear',
      });
    }
    return NextResponse.json(
      { response_action: 'errors', errors: { title_block: 'Failed to save. Try again.' } }
    );
  }

  // Trigger the LLM extraction pipeline (fire-and-forget, matching capture/route.ts pattern)
  const processUrl = new URL('/api/capture/process', requestUrl).toString();
  const processBody = JSON.stringify({ node_id: node.id });
  after(async () => {
    await fetch(processUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: processBody,
    }).catch(() => {});
  });

  // Post ephemeral confirmation back to Slack
  if (metadata.responseUrl) {
    after(async () => {
      await fetch(metadata.responseUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response_type: 'ephemeral',
          text: `Captured ✓ — *${title}* added to COF OS`,
        }),
      }).catch(() => {});
    });
  }

  // response_action: 'clear' closes the modal on the Slack side
  return NextResponse.json({ response_action: 'clear' });
}
