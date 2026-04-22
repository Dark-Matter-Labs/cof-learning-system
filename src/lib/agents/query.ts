export interface TourChapter {
  readonly title: string;
  readonly narrative: string;
  readonly nodeIds: readonly string[];
}

export interface TourResponse {
  readonly chapters: readonly TourChapter[];
}

export interface QuerySerializedNode {
  readonly id: string;
  readonly node_type: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: string;
}

const BASE_SYSTEM_PROMPT = `You are a knowledge graph assistant for a learning organization using the COF (Cycles of Feedback) method. The graph contains nodes representing hunches, assumptions, tests, learnings, commitments, signals, goal spaces, and more.

Answer the user's question based on the graph context provided. Be specific — reference node titles directly. Keep answers to 2–4 paragraphs. Write in plain language.`;

export function serializeNodesForQuery(nodes: QuerySerializedNode[]): string {
  const clean = (s: string) => s.replace(/\n/g, ' ');
  return nodes
    .map(n => `[${clean(n.node_type)}] ${clean(n.title)}${n.description ? `: ${clean(n.description)}` : ''} (id: ${n.id})`)
    .join('\n');
}

export function buildQuerySystemPrompt(userBackground?: string, userName?: string): string {
  if (!userBackground && !userName) return BASE_SYSTEM_PROMPT;
  if (!userBackground) return `${BASE_SYSTEM_PROMPT} The user is ${userName}.`;
  if (!userName) return `${BASE_SYSTEM_PROMPT} The person asking has a ${userBackground} background — frame your answer accordingly.`;
  return `${BASE_SYSTEM_PROMPT} The user is ${userName}, who has a ${userBackground} background — frame your answer accordingly.`;
}

export function buildTourPrompt(serializedGraph: string): string {
  return `Here is the full knowledge graph:\n\n${serializedGraph}\n\nGenerate a guided tour with these 5 chapters (do NOT include a chapter about "What is this system?" — that is handled separately):

Chapter titles must be exactly:
- "Our goals"
- "Key assumptions"
- "What we're testing"
- "What we've learned"
- "Where attention is needed"

For each chapter, write 2–4 sentences of plain-language narrative and list the IDs of the nodes you referenced.

Return ONLY a JSON object with this exact structure and no other text:
{"chapters":[{"title":"Our goals","narrative":"...","nodeIds":["id1","id2"]},{"title":"Key assumptions","narrative":"...","nodeIds":[]},{"title":"What we're testing","narrative":"...","nodeIds":[]},{"title":"What we've learned","narrative":"...","nodeIds":[]},{"title":"Where attention is needed","narrative":"...","nodeIds":[]}]}`;
}
