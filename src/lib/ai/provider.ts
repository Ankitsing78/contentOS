/**
 * ContentOS - Modular AI Provider Interface & Factory
 * Allows swapping Gemini, OpenAI, Anthropic, or local models without rewriting application logic.
 */

import {
  AIMessage,
  AIGenerationOptions,
  AITextResponse,
  AIStructuredResponse,
  AIProviderId,
} from '@/types';
import { isGeminiConfigured } from './config';
import { GeminiProvider } from './gemini';

export interface IAIProvider {
  readonly id: AIProviderId;
  generateText(
    messages: AIMessage[],
    options?: AIGenerationOptions
  ): Promise<AITextResponse>;
  generateStructured<T>(
    messages: AIMessage[],
    schemaDescription: string,
    options?: AIGenerationOptions
  ): Promise<AIStructuredResponse<T>>;
}

/**
 * Returns an AI provider instance based on environment configuration.
 */
export function getAIProvider(providerId?: AIProviderId): IAIProvider {
  const targetId = providerId || (process.env.AI_DEFAULT_PROVIDER as AIProviderId) || 'gemini';

  if (targetId === 'gemini') {
    if (!isGeminiConfigured()) {
      throw new Error(
        'Gemini AI Provider is selected but GEMINI_API_KEY is not configured in .env.local'
      );
    }
    return new GeminiProvider();
  }

  // Fallback placeholder for other providers pending integration
  return {
    id: targetId,
    async generateText() {
      throw new Error(
        `AI Provider '${targetId}' is not configured yet. Complete credentials in .env.local to activate.`
      );
    },
    async generateStructured<T>(): Promise<AIStructuredResponse<T>> {
      throw new Error(
        `AI Provider '${targetId}' is not configured yet. Complete credentials in .env.local to activate.`
      );
    },
  };
}
