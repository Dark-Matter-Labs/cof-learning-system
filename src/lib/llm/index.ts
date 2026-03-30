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
}

export interface LLMResponse {
  readonly content: string;
  readonly model: string;
  readonly usage?: { readonly input_tokens: number; readonly output_tokens: number };
}

type AgentName = 'extraction' | 'review' | 'create' | 'reflection';

function getAgentConfig(agent: AgentName): LLMConfig {
  const prefix = agent.toUpperCase();
  return {
    provider: process.env[`${prefix}_LLM_PROVIDER`] ?? 'anthropic',
    model: process.env[`${prefix}_LLM_MODEL`] ?? 'claude-sonnet-4-20250514',
    apiKey: process.env[`${prefix}_LLM_API_KEY`] ?? process.env.ANTHROPIC_API_KEY,
    baseUrl: process.env[`${prefix}_LLM_BASE_URL`],
  };
}

export async function callLLM(agent: AgentName, request: LLMRequest): Promise<LLMResponse> {
  const config = getAgentConfig(agent);

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
