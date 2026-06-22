import { createHash } from 'crypto';

// Voyage AI text embeddings. voyage-3.5 defaults to 1024-dim; we pin it so the
// pgvector column dimension (vector(1024)) stays in sync.
const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings';
export const EMBEDDING_MODEL = 'voyage-3.5';
export const EMBEDDING_DIM = 1024;
const MAX_BATCH = 1000;

export type EmbeddingInputType = 'query' | 'document';

/**
 * Stable content fingerprint for a node, used to skip re-embedding unchanged
 * text. Any change to title or description produces a different hash.
 */
export function contentHashForNode(title: string, description: string | null): string {
  return createHash('sha256').update(`${title}\n${description ?? ''}`).digest('hex');
}

/**
 * Embeds a batch of texts (≤1000). Returns one entry per input, in order;
 * an entry is `null` when embedding was unavailable. Never throws — a missing
 * VOYAGE_API_KEY or an API failure yields all-null (callers treat embeddings as
 * best-effort and fall back).
 */
export async function embedTexts(
  texts: string[],
  inputType: EmbeddingInputType = 'document',
): Promise<(number[] | null)[]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey || texts.length === 0 || texts.length > MAX_BATCH) {
    if (texts.length > MAX_BATCH) console.error('[embeddings] batch exceeds Voyage max of', MAX_BATCH);
    return texts.map(() => null);
  }

  try {
    const res = await fetch(VOYAGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        input: texts,
        model: EMBEDDING_MODEL,
        input_type: inputType,
        output_dimension: EMBEDDING_DIM,
      }),
    });
    if (!res.ok) {
      console.error('[embeddings] Voyage returned', res.status);
      return texts.map(() => null);
    }
    const json = (await res.json()) as { data?: Array<{ embedding: number[]; index: number }> };
    const out: (number[] | null)[] = texts.map(() => null);
    for (const item of json.data ?? []) {
      if (typeof item.index === 'number' && Array.isArray(item.embedding) && item.index < out.length) {
        out[item.index] = item.embedding;
      }
    }
    return out;
  } catch (err) {
    console.error('[embeddings] Voyage call failed:', err);
    return texts.map(() => null);
  }
}

/** Embeds a single text. Returns null when unavailable. */
export async function embedText(
  text: string,
  inputType: EmbeddingInputType = 'document',
): Promise<number[] | null> {
  const [embedding] = await embedTexts([text], inputType);
  return embedding ?? null;
}
