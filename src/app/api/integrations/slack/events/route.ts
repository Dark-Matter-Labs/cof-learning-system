import { NextResponse } from 'next/server';
import { verifySlackSignature, SlackVerificationError } from '@/lib/integrations/slack/verify';
import {
  handleSlashCommand,
  handleMessageAction,
  handleViewSubmission,
  type MessageActionPayload,
  type ViewSubmissionPayload,
} from '@/lib/integrations/slack/handler';

/**
 * POST /api/integrations/slack/events
 *
 * Unified handler for Slack slash commands and interactive payloads
 * (message shortcuts, modal submissions).
 *
 * This route is intentionally unauthenticated (no Supabase session check) —
 * authentication is provided by Slack's HMAC signature verification instead.
 * The middleware must exclude this path from the redirect-to-login behaviour.
 *
 * Slack payload types handled:
 *   - Slash command: body fields directly in application/x-www-form-urlencoded
 *   - message_action (message shortcut): `payload` form field → JSON
 *   - view_submission (modal submit):    `payload` form field → JSON
 */

export async function POST(request: Request) {
  // 1. Read raw body FIRST — signature verification requires the exact bytes
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 });
  }

  // 2. Verify Slack signature
  try {
    verifySlackSignature(request.headers, rawBody);
  } catch (err) {
    if (err instanceof SlackVerificationError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: 'Signature verification failed' }, { status: 403 });
  }

  // 3. Parse the URL-encoded body
  const params = new URLSearchParams(rawBody);

  // 4. Dispatch on payload type
  // Message shortcuts and modal submissions arrive with a `payload` JSON field.
  // Slash commands do not have a `payload` field — their fields are top-level.
  const payloadStr = params.get('payload');

  if (payloadStr) {
    // Interactive payload (message shortcut or view submission)
    let payload: { type: string } & Record<string, unknown>;
    try {
      payload = JSON.parse(payloadStr) as { type: string } & Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid payload JSON' }, { status: 400 });
    }

    switch (payload.type) {
      case 'message_action':
        return handleMessageAction(payload as unknown as MessageActionPayload);

      case 'view_submission':
        return handleViewSubmission(
          payload as unknown as ViewSubmissionPayload,
          request.url
        );

      default:
        // Unknown interaction type — acknowledge to prevent Slack retries
        return new NextResponse(null, { status: 200 });
    }
  } else {
    // Slash command: fields are directly in params
    return handleSlashCommand(params);
  }
}
