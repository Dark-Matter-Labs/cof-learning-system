import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { extractJson, parseLlmJson, tryParseLlmJson, parseLlmJsonLoose } from '../parse';

describe('extractJson', () => {
  it('returns a bare object unchanged', () => {
    expect(extractJson('{"a":1}')).toBe('{"a":1}');
  });

  it('strips ```json code fences', () => {
    expect(JSON.parse(extractJson('```json\n{"a":1}\n```'))).toEqual({ a: 1 });
  });

  it('strips plain ``` fences and leading prose', () => {
    expect(JSON.parse(extractJson('Here you go:\n```\n{"a":1}\n```'))).toEqual({ a: 1 });
  });

  it('drops trailing commentary after the object', () => {
    expect(JSON.parse(extractJson('{"a":1}\n\nHope that helps!'))).toEqual({ a: 1 });
  });

  it('extracts a top-level array (process.ts step-3 shape)', () => {
    expect(JSON.parse(extractJson('```json\n[{"id":1},{"id":2}]\n```'))).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('picks whichever of { or [ comes first', () => {
    // a brace inside prose before the real array should not win if the array is the payload...
    // here the object genuinely comes first, so it wins:
    expect(JSON.parse(extractJson('{"wrap":[1,2]}'))).toEqual({ wrap: [1, 2] });
  });

  it('ignores braces inside strings', () => {
    expect(JSON.parse(extractJson('{"text":"a } b { c"}'))).toEqual({ text: 'a } b { c' });
  });
});

describe('parseLlmJson', () => {
  const schema = z.object({ name: z.string(), n: z.number() });

  it('parses + validates a fenced response', () => {
    expect(parseLlmJson('```json\n{"name":"x","n":2}\n```', schema)).toEqual({ name: 'x', n: 2 });
  });

  it('throws on schema mismatch', () => {
    expect(() => parseLlmJson('{"name":"x"}', schema)).toThrow();
  });

  it('throws on invalid JSON', () => {
    expect(() => parseLlmJson('not json', schema)).toThrow();
  });
});

describe('tryParseLlmJson', () => {
  const schema = z.object({ ok: z.boolean() });

  it('returns the value on success', () => {
    expect(tryParseLlmJson('{"ok":true}', schema)).toEqual({ ok: true });
  });

  it('returns null on failure instead of throwing', () => {
    expect(tryParseLlmJson('garbage', schema)).toBeNull();
    expect(tryParseLlmJson('{"ok":"nope"}', schema)).toBeNull();
  });
});

describe('parseLlmJsonLoose', () => {
  it('parses fenced JSON without a schema', () => {
    expect(parseLlmJsonLoose('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('throws on invalid JSON', () => {
    expect(() => parseLlmJsonLoose('definitely not json')).toThrow();
  });
});
