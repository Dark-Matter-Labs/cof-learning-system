import type { LLMConfig, LLMRequest, LLMResponse } from '../index';

export async function callStub(config: LLMConfig, _request: LLMRequest): Promise<LLMResponse> {
  return {
    content: JSON.stringify({
      title: 'Stub extraction',
      summary: 'This is a stub response for development.',
      structured_claim: null,
      assumption_type: null,
      entities: [],
      domain_tags: [],
      suggested_connections: [],
      confidence_assessment: { level: 3, basis: 'intuition' },
      open_questions: [],
    }),
    model: config.model,
    usage: { input_tokens: 0, output_tokens: 0 },
  };
}
