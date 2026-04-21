// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockUpload, mockGetUser } = vi.hoisted(() => ({
  mockUpload: vi.fn(),
  mockGetUser: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({ upload: mockUpload })),
    },
  })),
}));

import { createClient } from '@/lib/supabase/server';
import { POST } from '../route';

function makeRequest(file: File | null): Request {
  const formData = new FormData();
  if (file) formData.append('file', file);
  return new Request('http://localhost/api/upload', {
    method: 'POST',
    body: formData,
  });
}

describe('POST /api/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockUpload.mockResolvedValue({ error: null });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: { getUser: mockGetUser },
    });
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('Unauthorized') });
    const res = await POST(makeRequest(new File(['x'], 'x.txt', { type: 'text/plain' })));
    expect(res.status).toBe(401);
  });

  it('returns 400 when no file provided', async () => {
    const res = await POST(makeRequest(null));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('No file provided');
  });

  it('returns 400 for unsupported MIME type', async () => {
    const file = new File(['x'], 'img.png', { type: 'image/png' });
    const res = await POST(makeRequest(file));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Only PDF, DOCX, and TXT files are supported');
  });

  it('returns 400 for file over 10MB', async () => {
    const largeContent = 'x'.repeat(10 * 1024 * 1024 + 1);
    const file = new File([largeContent], 'big.txt', { type: 'text/plain' });
    const res = await POST(makeRequest(file));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('File must be under 10MB');
  });

  it('uploads to Supabase with correct path format', async () => {
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    await POST(makeRequest(file));
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\/[0-9a-f-]+\.txt$/),
      expect.any(ArrayBuffer),
      { contentType: 'text/plain', upsert: false },
    );
  });

  it('returns metadata on success', async () => {
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    const res = await POST(makeRequest(file));
    expect(res.status).toBe(200);
    const body = await res.json() as { storage_path: string; filename: string; mime_type: string; size: number };
    expect(body.storage_path).toMatch(/^user-1\/[0-9a-f-]+\.txt$/);
    expect(body.filename).toBe('notes.txt');
    expect(body.mime_type).toBe('text/plain');
    expect(body.size).toBe(5);
  });
});
