import { callLLM } from '@/lib/llm';
import { parseLlmJsonLoose } from '@/lib/llm/parse';

const GOAL_SUGGEST_PROMPT = `You are helping a team articulate their strategic goals for a knowledge management system.
The user will describe what they're trying to do in plain language.
Your job is to distill it into a clear goal title and description.

Return ONLY valid JSON with no other text:
{
  "title": "Concise goal title (max 10 words)",
  "description": "2-sentence description of what success looks like"
}`;

const SEED_CHAT_PROMPT = (goals: ReadonlyArray<{ title: string }>) =>
  `You are helping a team seed their knowledge system. They have defined these goals:
${goals.map(g => `- ${g.title}`).join('\n')}

Ask about their hunches, assumptions, and learnings. After each response, extract 1-3 nodes.

Return ONLY valid JSON:
{
  "reply": "Your conversational response (1-2 sentences)",
  "extracted": [
    { "title": "Concise node title (max 10 words)", "node_type": "hunch|assumption_background|assumption_foreground|learning|signal" }
  ]
}

If the user hasn't shared enough yet, return extracted as [].`;

export interface GoalSuggestion {
  readonly title: string;
  readonly description: string;
}

export interface SeedChatInput {
  readonly message: string;
  readonly history: ReadonlyArray<{ readonly role: 'user' | 'assistant'; readonly content: string }>;
  readonly goals: ReadonlyArray<{ readonly title: string }>;
}

export interface SeedChatResult {
  readonly reply: string;
  readonly extracted: ReadonlyArray<{ readonly title: string; readonly node_type: string }>;
}

export async function suggestGoal(userInput: string): Promise<GoalSuggestion> {
  const response = await callLLM('setup', {
    systemPrompt: GOAL_SUGGEST_PROMPT,
    userMessage: userInput,
    maxTokens: 300,
  });

  let parsed: unknown;
  try {
    parsed = parseLlmJsonLoose(response.content);
  } catch {
    throw new Error('Failed to parse goal suggestion');
  }

  const { title, description } = parsed as { title: string; description: string };
  if (!title || !description) {
    throw new Error('Failed to parse goal suggestion');
  }
  return { title, description };
}

export async function processSeedChat(input: SeedChatInput): Promise<SeedChatResult> {
  const historyText = input.history
    .map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`)
    .join('\n');

  const userMessage = historyText
    ? `${historyText}\nUser: ${input.message}`
    : input.message;

  const response = await callLLM('setup', {
    systemPrompt: SEED_CHAT_PROMPT(input.goals),
    userMessage,
    maxTokens: 600,
  });

  let parsed: unknown;
  try {
    parsed = parseLlmJsonLoose(response.content);
  } catch {
    throw new Error('Failed to parse seed chat response');
  }

  const { reply, extracted } = parsed as { reply: string; extracted: ReadonlyArray<{ title: string; node_type: string }> };
  return { reply: reply ?? '', extracted: extracted ?? [] };
}
