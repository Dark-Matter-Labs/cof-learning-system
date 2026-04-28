const MIN_KEYWORD_LENGTH = 4;

export function extractKeywords(titles: string[]): string[] {
  return [...new Set(
    titles
      .join(' ')
      .toLowerCase()
      .split(/\W+/)
      .filter(word => word.length >= MIN_KEYWORD_LENGTH)
  )];
}

export function isRelevant(content: string, keywords: string[]): boolean {
  if (!content || keywords.length === 0) return false;
  const lower = content.toLowerCase();
  return keywords.some(kw => lower.includes(kw));
}

export function scoreRelevance(content: string, keywords: string[]): number {
  if (!content || keywords.length === 0) return 0;
  const lower = content.toLowerCase();
  return keywords.filter(kw => lower.includes(kw)).length;
}

export function filterRelevant<T>(
  items: ReadonlyArray<T>,
  getText: (item: T) => string,
  keywords: string[],
  limit: number
): T[] {
  return items
    .map(item => ({ item, score: scoreRelevance(getText(item), keywords) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item }) => item);
}
