import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseCaptureModalValues } from '../modal';
import { handleViewSubmission } from '../handler';
import type { ViewSubmissionPayload } from '../handler';

// ─── Modal value parsing tests ───────────────────────────────────────────────

describe('parseCaptureModalValues', () => {
  it('extracts all fields from a complete state.values object', () => {
    const values = {
      title_block: { title_input: { value: '  My Capture Title  ' } },
      node_type_block: {
        node_type_select: { selected_option: { value: 'learning' } },
      },
      description_block: { description_input: { value: 'Some context here' } },
      source_url_block: { source_url_input: { value: 'https://example.com' } },
    };

    const result = parseCaptureModalValues(values);
    expect(result.title).toBe('My Capture Title');
    expect(result.nodeType).toBe('learning');
    expect(result.description).toBe('Some context here');
    expect(result.sourceUrl).toBe('https://example.com');
  });

  it('defaults nodeType to hunch when no option selected', () => {
    const values = {
      title_block: { title_input: { value: 'Title' } },
      node_type_block: { node_type_select: {} },
      description_block: { description_input: {} },
      source_url_block: { source_url_input: {} },
    };

    const result = parseCaptureModalValues(values);
    expect(result.nodeType).toBe('hunch');
  });

  it('returns null description when optional field is empty', () => {
    const values = {
      title_block: { title_input: { value: 'Title' } },
      node_type_block: {
        node_type_select: { selected_option: { value: 'hunch' } },
      },
      description_block: { description_input: { value: undefined } },
      source_url_block: { source_url_input: { value: '' } },
    };

    const result = parseCaptureModalValues(values);
    expect(result.description).toBeNull();
    expect(result.sourceUrl).toBeNull();
  });

  it('trims whitespace from all string fields', () => {
    const values = {
      title_block: { title_input: { value: '  Padded  ' } },
      node_type_block: {
        node_type_select: { selected_option: { value: 'option' } },
      },
      description_block: { description_input: { value: '  spaced  ' } },
      source_url_block: { source_url_input: { value: '  https://example.com  ' } },
    };

    const result = parseCaptureModalValues(values);
    expect(result.title).toBe('Padded');
    expect(result.description).toBe('spaced');
    expect(result.sourceUrl).toBe('https://example.com');
  });
});

// ─── handleViewSubmission — DB write happy path ──────────────────────────────

const MOCK_NODE_ID = 'aaa00000-0000-0000-0000-000000000001';

function makeViewSubmissionPayload(
  titleValue: string,
  nodeType = 'hunch'
): ViewSubmissionPayload {
  return {
    type: 'view_submission',
    user: { id: 'USLACK001', name: 'testuser' },
    team: { id: 'TWORKSPACE' },
    view: {
      callback_id: 'cof_capture_modal',
      private_metadata: JSON.stringify({
        channelId: 'CCHANNEL01',
        messageTs: '1234567890.000100',
      }),
      state: {
        values: {
          title_block: { title_input: { value: titleValue } },
          node_type_block: {
            node_type_select: { selected_option: { value: nodeType } },
          },
          description_block: { description_input: { value: null as unknown as undefined } },
          source_url_block: { source_url_input: { value: null as unknown as undefined } },
        },
      },
    },
  };
}

describe('handleViewSubmission', () => {
  beforeEach(() => {
    // Mock the admin client module
    vi.mock('@/lib/supabase/admin', () => ({
      createAdminClient: () => ({
        from: () => ({
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({
                data: { id: MOCK_NODE_ID, title: 'Test' },
                error: null,
              }),
            }),
          }),
        }),
      }),
    }));

    // Mock crypto module to avoid INTEGRATION_TOKEN_ENCRYPTION_KEY requirement
    vi.mock('@/lib/integrations/crypto', () => ({
      encryptToken: (t: string) => ({ ciphertext: `enc:${t}`, iv: 'testiv' }),
      decryptToken: (c: string) => c.replace('enc:', ''),
    }));

    // after() is a no-op in tests
    vi.mock('next/server', async (importOriginal) => {
      const actual = await importOriginal<typeof import('next/server')>();
      return {
        ...actual,
        after: vi.fn(() => {
          // fire-and-forget in tests — we don't await background tasks
        }),
      };
    });

    process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.SLACK_BOT_TOKEN;
  });

  it('returns response_action clear on successful DB write', async () => {
    const payload = makeViewSubmissionPayload('My test capture');
    const res = await handleViewSubmission(payload, 'http://localhost:3000');
    const body = await res.json();
    expect(body).toEqual({ response_action: 'clear' });
  });

  it('returns validation error when title is empty', async () => {
    const payload = makeViewSubmissionPayload('   ');
    const res = await handleViewSubmission(payload, 'http://localhost:3000');
    const body = await res.json();
    expect(body.response_action).toBe('errors');
    expect(body.errors).toHaveProperty('title_block');
  });

  it('ignores modal with unknown callback_id', async () => {
    const payload: ViewSubmissionPayload = {
      ...makeViewSubmissionPayload('irrelevant'),
      view: {
        ...makeViewSubmissionPayload('irrelevant').view,
        callback_id: 'some_other_modal',
      },
    };
    const res = await handleViewSubmission(payload, 'http://localhost:3000');
    const body = await res.json();
    expect(body).toEqual({ response_action: 'clear' });
  });

  it('returns errors response when DB insert returns a non-dedup error', async () => {
    vi.mock('@/lib/supabase/admin', () => ({
      createAdminClient: () => ({
        from: () => ({
          insert: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: null,
                  error: { message: 'connection error', code: '08006' },
                }),
            }),
          }),
        }),
      }),
    }));

    const payload = makeViewSubmissionPayload('Some title');
    const res = await handleViewSubmission(payload, 'http://localhost:3000');
    const body = await res.json();
    expect(body.response_action).toBe('errors');
  });

  it('handles dedup gracefully (23505 unique constraint violation)', async () => {
    vi.mock('@/lib/supabase/admin', () => ({
      createAdminClient: () => ({
        from: () => ({
          insert: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: null,
                  error: {
                    message: 'duplicate key value violates unique constraint',
                    code: '23505',
                  },
                }),
            }),
          }),
        }),
      }),
    }));

    const payload = makeViewSubmissionPayload('Duplicate capture');
    const res = await handleViewSubmission(payload, 'http://localhost:3000');
    const body = await res.json();
    // Dedup should silently succeed (already captured)
    expect(body).toEqual({ response_action: 'clear' });
  });
});
