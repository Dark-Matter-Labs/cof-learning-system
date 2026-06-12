import type { z } from 'zod';

/**
 * Extracts a JSON value from LLM output, tolerating ```json code fences,
 * leading prose, and trailing commentary. Returns the substring spanning the
 * first balanced object `{...}` or array `[...]` (whichever appears first).
 *
 * This is the single seam every agent parses LLM JSON through, replacing the
 * six bespoke variants that previously diverged (raw JSON.parse with no fence
 * handling, ad-hoc fence regexes, object-only extraction that broke on arrays).
 */
export function extractJson(text: string): string {
  const objIdx = text.indexOf('{');
  const arrIdx = text.indexOf('[');
  if (objIdx === -1 && arrIdx === -1) return text.trim();

  let start: number;
  let open: string;
  let close: string;
  if (arrIdx === -1 || (objIdx !== -1 && objIdx < arrIdx)) {
    start = objIdx; open = '{'; close = '}';
  } else {
    start = arrIdx; open = '['; close = ']';
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escaped) { escaped = false; continue; }
    if (c === '\\' && inString) { escaped = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (!inString) {
      if (c === open) depth++;
      else if (c === close) { depth--; if (depth === 0) return text.slice(start, i + 1); }
    }
  }
  return text.slice(start);
}

/** Parse + validate against a Zod schema. Throws on invalid JSON or schema mismatch. */
export function parseLlmJson<T>(content: string, schema: z.ZodType<T>): T {
  return schema.parse(JSON.parse(extractJson(content)));
}

/** Non-throwing variant — returns null on any parse or validation failure. */
export function tryParseLlmJson<T>(content: string, schema: z.ZodType<T>): T | null {
  try {
    return parseLlmJson(content, schema);
  } catch {
    return null;
  }
}

/**
 * Parse without schema validation, for callers that validate downstream or
 * accept arbitrary shapes. Throws on invalid JSON. Returns `unknown` — narrow
 * or validate before use.
 */
export function parseLlmJsonLoose(content: string): unknown {
  return JSON.parse(extractJson(content));
}
