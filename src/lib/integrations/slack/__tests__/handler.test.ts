import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleModalSubmission } from '../handler';
import type { ViewSubmissionPayload } from '../handler';

// ─────────────────────────────────────────────
// Top-level mocks — vi.mock must be at top level, never nested
// ─────────────────────────────────────────────

const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();
const mockEq = vi.fn();

// Build a chainable Supabase query mock
function makeChain(terminal: () => unknown) {
  const chain = {
    select: () => chain,
    eq: (..._args: unknown[]) => { mockEq(..._args); return chain; },
    maybeSingle: () => mockMaybeSingle(),
    single: () => mockSingle(),
  };
  return chain;
}

const mockSupabase = {
  from: vi.fn((_table: string) => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: () => mockMaybeSingle(),
        })),
      })),
    })),
    insert: vi.fn((...args: unknown[]) => {
      mockInsert(...args);
      return {
        select: vi.fn(() => ({
          single: () => mockSingle(),
        })),
      };
    }),
  })),
} as unknown as import('@supabase/supabase-js').SupabaseClient;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function makePayload(overrides: Partial<{
  title: string;
  description: string;
  nodeType: string;
  sourceUrl: string;
  privateMetadata: string;
}>  = {}): ViewSubmissionPayload {
  return {
    type: 'view_submission',
    user: { id: 'U_SLACK_USER' },
    view: {
      callback_id: 'capture_modal',
      private_metadata: overrides.privateMetadata ?? '',
      state: {
        values: {
          title_block: {
            title: { value: overrides.title ?? 'Test node title' },
          },
          description_block: {
            description: { value: overrides.description ?? null },
          },
          node_type_block: {
            node_type: {
              selected_option: { value: overrides.nodeType ?? 'hunch' },
            },
          },
          source_url_block: {
            source_url: { value: overrides.sourceUrl ?? null },
          },
        },
      },
    },
  };
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('handleModalSubmission', () => {
  const TEST_USER_ID = 'cof-user-uuid-123';

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no dedup match found
    mockMaybeSingle.mockImplementation(async () => ({ data: null, error: null }));
    // Default: insert returns a node (overridden per-test as needed)
    mockSingle.mockImplementation(async () => ({ data: { id: 'default-node-id' }, error: null }));
  });

  it('happy path: writes a node with correct fields and returns the node ID', async () => {
    const expectedNodeId = 'new-node-uuid-abc';

    // Insert succeeds (dedup is skipped — no slack_ts in payload)
    mockSingle.mockImplementationOnce(async () => ({
      data: { id: expectedNodeId },
      error: null,
    }));

    const payload = makePayload({
      title: 'Interesting signal',
      description: 'Saw something worth tracking',
      nodeType: 'signal',
    });

    const result = await handleModalSubmission(payload, mockSupabase, TEST_USER_ID);

    expect(result.nodeId).toBe(expectedNodeId);
    expect(result.isDuplicate).toBe(false);
    expect(result.error).toBeUndefined();
  });

  it('dedup: returns existing node ID without creating a duplicate when source_ref matches', async () => {
    const existingNodeId = 'existing-node-uuid-xyz';

    // Dedup match found
    mockMaybeSingle.mockImplementationOnce(async () => ({
      data: { id: existingNodeId },
      error: null,
    }));

    const payload = makePayload({
      title: 'Some hunch',
      privateMetadata: JSON.stringify({
        slack_ts: '1234567890.123456',
        slack_channel: 'C_CHANNEL_ID',
      }),
    });

    const result = await handleModalSubmission(payload, mockSupabase, TEST_USER_ID);

    expect(result.nodeId).toBe(existingNodeId);
    expect(result.isDuplicate).toBe(true);
    // Should not have called insert
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('missing title: returns an error without writing to DB', async () => {
    const payload = makePayload({ title: '' });

    const result = await handleModalSubmission(payload, mockSupabase, TEST_USER_ID);

    expect(result.nodeId).toBeNull();
    expect(result.error).toBe('Title is required');
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('whitespace-only title: returns an error', async () => {
    const payload = makePayload({ title: '   ' });

    const result = await handleModalSubmission(payload, mockSupabase, TEST_USER_ID);

    expect(result.nodeId).toBeNull();
    expect(result.error).toBe('Title is required');
  });

  it('DB insert error: surfaces the error message', async () => {
    // Insert fails (dedup is skipped — no slack_ts in payload)
    mockSingle.mockImplementationOnce(async () => ({
      data: null,
      error: { message: 'duplicate key value violates unique constraint' },
    }));

    const payload = makePayload({ title: 'Valid title' });

    const result = await handleModalSubmission(payload, mockSupabase, TEST_USER_ID);

    expect(result.nodeId).toBeNull();
    expect(result.error).toContain('duplicate key');
  });

  it('sets source to "slack" and node_type from the modal select', async () => {
    let capturedInsertData: Record<string, unknown> | null = null;

    // Override insert to capture its argument
    const capturingSupabase = {
      from: vi.fn((_table: string) => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: async () => ({ data: null, error: null }),
            })),
          })),
        })),
        insert: vi.fn((data: Record<string, unknown>) => {
          capturedInsertData = data;
          return {
            select: vi.fn(() => ({
              single: async () => ({ data: { id: 'node-id-999' }, error: null }),
            })),
          };
        }),
      })),
    } as unknown as import('@supabase/supabase-js').SupabaseClient;

    const payload = makePayload({ title: 'My learning', nodeType: 'learning' });

    await handleModalSubmission(payload, capturingSupabase, TEST_USER_ID);

    expect(capturedInsertData).not.toBeNull();
    expect(capturedInsertData!['source']).toBe('slack');
    expect(capturedInsertData!['node_type']).toBe('learning');
    expect(capturedInsertData!['author_id']).toBe(TEST_USER_ID);
    expect(capturedInsertData!['status']).toBe('raw');
  });
});
