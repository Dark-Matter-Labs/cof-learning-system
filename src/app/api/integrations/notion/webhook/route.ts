import { NextResponse } from 'next/server';

/**
 * POST /api/integrations/notion/webhook
 *
 * Receives page creation/update events from Notion.
 *
 * This route is unauthenticated (no Supabase session). Requests from Notion
 * are authenticated via HMAC signature verification.
 *
 * TODO: Implement the following steps:
 * 1. Read raw body: `const rawBody = await request.text()`
 * 2. Verify Notion webhook signature:
 *    - Header: confirm the correct header name from Notion docs
 *      (likely `X-Notion-Signature` or similar — see open question #2 in
 *      .planning/integrations-v1.md)
 *    - Algorithm: HMAC-SHA256(NOTION_WEBHOOK_SECRET, rawBody)
 *    - Use timingSafeEqual for comparison
 * 3. Parse page payload from rawBody
 * 4. Look up the user's Notion token from source_integrations
 * 5. Fetch page properties via Notion API
 * 6. Map page properties → node fields (title, description, etc.)
 * 7. Insert node with source='notion', source_ref=`notion:{pageId}`
 * 8. Trigger /api/capture/process via after()
 * 9. (Out of scope v1) Write "Captured ✓" property back to page
 *
 * Required env vars: NOTION_WEBHOOK_SECRET
 *
 * See: src/integrations/notion/README.md
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Notion webhook not yet implemented. See src/integrations/notion/README.md' },
    { status: 501 }
  );
}
