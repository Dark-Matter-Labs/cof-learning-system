import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { verifySlackSignature } from '@/lib/integrations/slack/verify';
import {
  handleSlashCommand,
  handleShortcut,
  handleModalSubmission,
} from '@/lib/integrations/slack/handler';

/**
 * Resolve the Supabase user_id from a Slack user_id.
 * Looks up the source_integrations table to find which COF user
 * has this Slack workspace + user ID connected.
 *
 * Returns null if no match is found.
 */
async function resolveUserId(
  supabase: ReturnType<typeof createAdminClient>,
  slackUserId: string,
  teamId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('source_integrations')
    .select('user_id, metadata')
    .eq('source', 'slack')
    .eq('workspace_id', teamId)
    .maybeSingle();

  if (!data) return null;

  // For single-workspace installs the bot token is per-team, not per-user.
  // We match the team and trust Slack's authentication of the user.
  // The user_id stored is the COF user who installed the app.
  // TODO: when multi-user per workspace is supported, look up a user mapping table.
  const _ = slackUserId; // acknowledged — single-user-per-workspace for v1
  return data.user_id as string;
}

/**
 * POST /api/integrations/slack/events
 *
 * Handles:
 * - Slash commands (application/x-www-form-urlencoded)
 * - Message shortcuts (JSON in `payload` form field)
 * - Modal view submissions (JSON in `payload` form field)
 *
 * CRITICAL: Signature verification happens before body parsing.
 * We read the raw body as text first, then parse.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    return NextResponse.json(
      { error: 'Slack signing secret not configured' },
      { status: 503 },
    );
  }

  // Read raw body for signature verification
  const rawBody = await request.text();

  const signature = request.headers.get('x-slack-signature') ?? '';
  const timestamp = request.headers.get('x-slack-request-timestamp') ?? '';

  if (!verifySlackSignature(signingSecret, signature, timestamp, rawBody)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const contentType = request.headers.get('content-type') ?? '';

  // Slack sends slash commands as application/x-www-form-urlencoded
  // Shortcuts and modal submissions also come form-encoded but with a `payload` field
  let formData: URLSearchParams;
  try {
    formData = new URLSearchParams(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Check if this is a payload-based event (shortcut / view_submission)
  const payloadField = formData.get('payload');

  if (payloadField) {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(payloadField) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid payload JSON' }, { status: 400 });
    }

    const payloadType = payload.type as string | undefined;
    const slackUserId =
      (payload.user as { id?: string } | undefined)?.id ?? '';
    const teamId =
      (payload.team as { id?: string } | undefined)?.id ??
      (payload.view as { team_id?: string } | undefined)?.team_id ??
      '';

    const supabase = createAdminClient();
    const userId = await resolveUserId(supabase, slackUserId, teamId);

    if (!userId) {
      return NextResponse.json(
        { error: 'No COF account linked to this Slack workspace' },
        { status: 403 },
      );
    }

    if (payloadType === 'shortcut' || payloadType === 'message_action') {
      await handleShortcut(
        payload as unknown as Parameters<typeof handleShortcut>[0],
        supabase,
        userId,
      );
      return NextResponse.json({});
    }

    if (payloadType === 'view_submission') {
      const viewPayload = payload as unknown as Parameters<typeof handleModalSubmission>[0];
      if (viewPayload.view?.callback_id !== 'capture_modal') {
        return NextResponse.json({});
      }

      const result = await handleModalSubmission(viewPayload, supabase, userId);

      if (result.error) {
        // Return validation error to Slack (displayed in modal)
        return NextResponse.json({
          response_action: 'errors',
          errors: {
            title_block: result.error,
          },
        });
      }

      // Close the modal on success
      return NextResponse.json({ response_action: 'clear' });
    }

    // Unknown payload type — acknowledge silently
    return NextResponse.json({});
  }

  // Slash command (no payload field)
  const _ = contentType; // acknowledged
  const command = formData.get('command');
  const triggerId = formData.get('trigger_id') ?? '';
  const slackUserId = formData.get('user_id') ?? '';
  const teamId = formData.get('team_id') ?? '';
  const text = formData.get('text') ?? '';

  if (!command) {
    return NextResponse.json({ error: 'Missing command' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const userId = await resolveUserId(supabase, slackUserId, teamId);

  if (!userId) {
    return NextResponse.json(
      {
        response_type: 'ephemeral',
        text: 'No COF account is linked to this Slack workspace. Visit your settings to connect.',
      },
    );
  }

  if (command === '/cof') {
    await handleSlashCommand(
      { command, text, trigger_id: triggerId, user_id: slackUserId, team_id: teamId },
      supabase,
      userId,
    );
    return NextResponse.json({});
  }

  return NextResponse.json({ error: 'Unknown command' }, { status: 400 });
}
