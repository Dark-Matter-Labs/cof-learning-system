import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { embedText, embedTexts, contentHashForNode } from '../embeddings';

const ORIGINAL_KEY = process.env.VOYAGE_API_KEY;

describe('contentHashForNode', () => {
  it('is stable for the same content and sensitive to changes', () => {
    const a = contentHashForNode('Title', 'desc');
    expect(contentHashForNode('Title', 'desc')).toBe(a);
    expect(contentHashForNode('Title', 'different')).not.toBe(a);
    expect(contentHashForNode('Other', 'desc')).not.toBe(a);
  });

  it('treats null description distinctly from empty but consistently', () => {
    expect(contentHashForNode('T', null)).toBe(contentHashForNode('T', null));
  });
});

describe('embedTexts', () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { process.env.VOYAGE_API_KEY = ORIGINAL_KEY; });

  it('returns all-null and makes no call when the key is unset', async () => {
    delete process.env.VOYAGE_API_KEY;
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;
    const out = await embedTexts(['a', 'b']);
    expect(out).toEqual([null, null]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends the Voyage request and maps embeddings back by index', async () => {
    process.env.VOYAGE_API_KEY = 'test-key';
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [
        { index: 1, embedding: [0.3, 0.4] },
        { index: 0, embedding: [0.1, 0.2] },
      ] }),
    });
    global.fetch = fetchSpy;

    const out = await embedTexts(['first', 'second'], 'query');

    expect(out).toEqual([[0.1, 0.2], [0.3, 0.4]]);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.voyageai.com/v1/embeddings');
    expect(init.headers.Authorization).toBe('Bearer test-key');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ model: 'voyage-3.5', input_type: 'query', output_dimension: 1024, input: ['first', 'second'] });
  });

  it('returns all-null on a non-ok response', async () => {
    process.env.VOYAGE_API_KEY = 'test-key';
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 429 });
    expect(await embedTexts(['a'])).toEqual([null]);
  });

  it('returns all-null when fetch throws (non-fatal)', async () => {
    process.env.VOYAGE_API_KEY = 'test-key';
    global.fetch = vi.fn().mockRejectedValue(new Error('network'));
    expect(await embedTexts(['a'])).toEqual([null]);
  });

  it('embedText returns a single vector', async () => {
    process.env.VOYAGE_API_KEY = 'test-key';
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ index: 0, embedding: [1, 2, 3] }] }),
    });
    expect(await embedText('hi')).toEqual([1, 2, 3]);
  });
});
