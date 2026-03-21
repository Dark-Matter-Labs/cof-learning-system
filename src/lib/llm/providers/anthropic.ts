import Anthropic from '@anthropic-ai/sdk';
import type { LLMConfig, LLMRequest, LLMResponse } from '../index';

export async function callAnthropic(config: LLMConfig, request: LLMRequest): Promise<LLMResponse> {
  const client = new Anthropic({ apiKey: config.apiKey });

  const message = await client.messages.create({
    model: config.model,
    max_tokens: request.maxTokens ?? 4096,
    temperature: request.temperature ?? 0.3,
    system: request.systemPrompt,
    messages: [{ role: 'user', content: request.userMessage }],
  });

  const textBlock = message.content.find(block => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Anthropic');
  }

  return {
    content: textBlock.text,
    model: message.model,
    usage: {
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
    },
  };
}
