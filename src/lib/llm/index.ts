// src/lib/llm/index.ts
import { hashRequest, getCached, setCached, shouldCache } from './cache';
import { logUsage } from './usage';

export interface LLMConfig {
  readonly provider: string;
  readonly model: string;
  readonly apiKey?: string;
  readonly baseUrl?: string;
}

export interface LLMRequest {
  readonly systemPrompt: string;
  readonly userMessage: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly pdfBase64?: string;
}

export interface LLMResponse {
  readonly content: string;
  readonly model: string;
  readonly usage?: { readonly input_tokens: number; readonly output_tokens: number };
}

// Default model per agent. Haiku for high-volume agents, Sonnet for reasoning agents.
const AGENT_DEFAULT_MODELS: Record<string, string> = {
  extraction: 'claude-haiku-4-5-20251001',
  review: 'claude-haiku-4-5-20251001',
  process: 'claude-haiku-4-5-20251001',
  reflection: 'claude-sonnet-4-6',
  create: 'claude-sonnet-4-6',
  setup: 'claude-sonnet-4-6',
  query: 'claude-sonnet-4-6',
  digest: 'claude-sonnet-4-6',
  portfolio: 'claude-sonnet-4-6',
  newsletter: 'claude-sonnet-4-6',
  correction: 'claude-sonnet-4-6',
};

export type AgentName = 'extraction' | 'review' | 'create' | 'reflection' | 'process' | 'setup' | 'query' | 'digest' | 'portfolio' | 'newsletter' | 'correction';

function getAgentConfig(agent: AgentName): LLMConfig {
  const prefix = agent.toUpperCase();
  return {
    provider: process.env[`${prefix}_LLM_PROVIDER`] ?? 'anthropic',
    model: process.env[`${prefix}_LLM_MODEL`] ?? AGENT_DEFAULT_MODELS[agent] ?? 'claude-sonnet-4-6',
    apiKey: process.env[`${prefix}_LLM_API_KEY`] ?? process.env.ANTHROPIC_API_KEY,
    baseUrl: process.env[`${prefix}_LLM_BASE_URL`],
  };
}

async function callProvider(config: LLMConfig, request: LLMRequest): Promise<LLMResponse> {
  switch (config.provider) {
    case 'anthropic': {
      const { callAnthropic } = await import('./providers/anthropic');
      return callAnthropic(config, request);
    }
    default: {
      const { callStub } = await import('./providers/stub');
      return callStub(config, request);
    }
  }
}

export async function callLLM(agent: AgentName, request: LLMRequest): Promise<LLMResponse> {
  const config = getAgentConfig(agent);

  if (shouldCache(agent)) {
    const cacheKey = hashRequest(agent, request.systemPrompt, request.userMessage, request.pdfBase64);
    const cached = await getCached(cacheKey);
    if (cached) {
      await logUsage(agent, config.model, cached, true);
      return cached;
    }

    const response = await callProvider(config, request);
    await Promise.all([
      setCached(cacheKey, agent, config.model, response),
      logUsage(agent, config.model, response, false),
    ]);
    return response;
  }

  const response = await callProvider(config, request);
  await logUsage(agent, config.model, response, false);
  return response;
}
