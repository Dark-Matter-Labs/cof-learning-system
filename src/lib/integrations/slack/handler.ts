import type { SupabaseClient } from '@supabase/supabase-js';
import { buildCaptureModal } from './modal';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface SlackResponse {
  response_type?: 'ephemeral' | 'in_channel';
  text?: string;
  [key: string]: unknown;
}

export interface SlashCommandPayload {
  command: string;
  text?: string;
  trigger_id: string;
  user_id: string;
  team_id: string;
  channel_id?: string;
}

export interface ShortcutPayload {
  type: 'shortcut' | 'message_action';
  callback_id: string;
  trigger_id: string;
  user: { id: string };
  message?: {
    text?: string;
    ts?: string;
  };
}

export interface ViewSubmissionPayload {
  type: 'view_submission';
  user: { id: string };
  view: {
    callback_id: string;
    state: {
      values: {
        title_block?: { title?: { value?: string | null } };
        description_block?: { description?: { value?: string | null } };
        node_type_block?: {
          node_type?: { selected_option?: { value?: string } | null };
        };
        source_url_block?: { source_url?: { value?: string | null } };
      };
    };
    private_metadata?: string;
  };
}

const VALID_NODE_TYPES = [
  'hunch',
  'assumption_background',
  'assumption_foreground',
  'test',
  'signal',
  'learning',
  'option',
] as const;

type ValidNodeType = (typeof VALID_NODE_TYPES)[number];

function isValidNodeType(value: string | undefined): value is ValidNodeType {
  return VALID_NODE_TYPES.includes(value as ValidNodeType);
}

// ─────────────────────────────────────────────
// Slash command handler
// ─────────────────────────────────────────────

/**
 * Handles /cof slash commands.
 * Returns a Slack views.open call response (200 with trigger) immediately.
 * The trigger_id is used client-side by the caller to open the modal.
 */
export async function handleSlashCommand(
  payload: SlashCommandPayload,
  _supabase: SupabaseClient,
  _userId: string,
): Promise<SlackResponse> {
  // Prefill title from the text the user typed after the command
  const prefill = payload.text?.trim()
    ? { title: payload.text.trim() }
    : undefined;

  const modal = buildCaptureModal(payload.trigger_id, prefill);

  // Open modal via Slack API — fire and forget; caller returns 200 immediately
  const botToken = process.env.SLACK_BOT_TOKEN;
  if (botToken) {
    fetch('https://slack.com/api/views.open', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${botToken}`,
      },
      body: JSON.stringify(modal),
    }).catch(() => {});
  }

  // Return empty 200 to satisfy Slack's <3s timeout
  return {};
}

// ─────────────────────────────────────────────
// Message shortcut handler
// ─────────────────────────────────────────────

/**
 * Handles message shortcuts (right-click → "Save to COF").
 * Opens the capture modal pre-filled with the message text.
 */
export async function handleShortcut(
  payload: ShortcutPayload,
  _supabase: SupabaseClient,
  _userId: string,
): Promise<SlackResponse> {
  const messageText = payload.message?.text;
  const prefill = messageText
    ? { description: messageText.slice(0, 3000) }
    : undefined;

  const modal = buildCaptureModal(payload.trigger_id, prefill);

  const botToken = process.env.SLACK_BOT_TOKEN;
  if (botToken) {
    fetch('https://slack.com/api/views.open', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${botToken}`,
      },
      body: JSON.stringify(modal),
    }).catch(() => {});
  }

  return {};
}

// ─────────────────────────────────────────────
// Modal submission handler
// ─────────────────────────────────────────────

export interface ModalSubmissionResult {
  nodeId: string | null;
  isDuplicate: boolean;
  error?: string;
}

/**
 * Handles view_submission for callback_id === 'capture_modal'.
 * Writes the node to the DB (or returns existing ID on dedup),
 * then posts an ephemeral confirmation message.
 */
export async function handleModalSubmission(
  payload: ViewSubmissionPayload,
  supabase: SupabaseClient,
  userId: string,
): Promise<ModalSubmissionResult> {
  const values = payload.view.state.values;

  const title = values.title_block?.title?.value?.trim();
  const description = values.description_block?.description?.value?.trim() ?? null;
  const nodeTypeRaw = values.node_type_block?.node_type?.selected_option?.value;
  const sourceUrl = values.source_url_block?.source_url?.value?.trim() ?? null;

  // Validate required fields
  if (!title) {
    return { nodeId: null, isDuplicate: false, error: 'Title is required' };
  }

  const nodeType: ValidNodeType = isValidNodeType(nodeTypeRaw)
    ? nodeTypeRaw
    : 'hunch';

  // Build source_ref from metadata if available
  const privateMetadata = payload.view.private_metadata
    ? (() => {
        try {
          return JSON.parse(payload.view.private_metadata);
        } catch {
          return {};
        }
      })()
    : {};

  const sourceRef: string | null = privateMetadata.slack_ts
    ? `${privateMetadata.slack_channel ?? 'unknown'}:${privateMetadata.slack_ts}`
    : null;

  // Dedup check — if this source_ref already exists, return existing node
  if (sourceRef) {
    const { data: existing } = await supabase
      .from('nodes')
      .select('id')
      .eq('source', 'slack')
      .eq('source_ref', sourceRef)
      .maybeSingle();

    if (existing) {
      return { nodeId: existing.id, isDuplicate: true };
    }
  }

  const externalLinks = sourceUrl
    ? [{ url: sourceUrl, label: sourceUrl, added_at: new Date().toISOString() }]
    : [];

  const { data: node, error } = await supabase
    .from('nodes')
    .insert({
      node_type: nodeType,
      title,
      description,
      hunch_type: 'new',
      confidence_level: 3,
      confidence_basis: 'intuition',
      status: 'raw',
      author_id: userId,
      external_links: externalLinks,
      source: 'slack',
      source_ref: sourceRef,
      source_payload: privateMetadata ?? null,
    })
    .select('id')
    .single();

  if (error) {
    return { nodeId: null, isDuplicate: false, error: error.message };
  }

  return { nodeId: node.id, isDuplicate: false };
}
