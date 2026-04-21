import Anthropic from '@anthropic-ai/sdk';
import type { LLMConfig, LLMRequest, LLMResponse } from '../index';

export async function callAnthropic(config: LLMConfig, request: LLMRequest): Promise<LLMResponse> {
  const client = new Anthropic({ apiKey: config.apiKey });

  const userContent = request.pdfBase64
    ? [
        {
          type: 'document' as const,
          source: {
            type: 'base64' as const,
            media_type: 'application/pdf' as const,
            data: request.pdfBase64,
          },
        },
        { type: 'text' as const, text: request.userMessage },
      ]
    : request.userMessage;

  const message = await client.messages.create({
    model: config.model,
    max_tokens: request.maxTokens ?? 4096,
    temperature: request.temperature ?? 0.3,
    system: request.systemPrompt,
    messages: [{ role: 'user', content: userContent as Parameters<typeof client.messages.create>[0]['messages'][0]['content'] }],
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
