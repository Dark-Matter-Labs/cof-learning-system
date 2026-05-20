import { NextResponse } from 'next/server';

/**
 * POST /api/integrations/notion/webhook
 *
 * TODO (Phase 2): Handle Notion webhook events.
 *
 * Steps to implement:
 * 1. Read raw body as text for signature verification
 * 2. Verify HMAC-SHA256 signature using NOTION_WEBHOOK_SECRET
 * 3. Parse event body (JSON)
 * 4. Handle event types:
 *    - page.created / page.updated → fetch page content, write node
 *    - block.created → optionally capture individual blocks
 * 5. Write node with source='notion', source_ref=<notion_page_id>
 * 6. Trigger /api/capture/process for LLM pipeline
 * 7. Return 200 quickly (Notion may retry on timeout)
 *
 * Required env vars: NOTION_WEBHOOK_SECRET
 */
export async function POST(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'Notion webhook not yet implemented' },
    { status: 501 },
  );
}
