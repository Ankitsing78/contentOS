/**
 * ContentOS - Google Gemini AI Provider Implementation
 * Server-only module using the official @google/genai SDK.
 */

import 'server-only';
import { GoogleGenAI } from '@google/genai';
import {
  AIMessage,
  AIGenerationOptions,
  AITextResponse,
  AIStructuredResponse,
} from '@/types';
import { IAIProvider } from './provider';
import { AI_CONFIG } from './config';

export class GeminiProvider implements IAIProvider {
  readonly id = 'gemini' as const;
  private client: GoogleGenAI;

  constructor(apiKey?: string) {
    const key =
      apiKey ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_AI_API_KEY ||
      process.env.GOOGLE_API_KEY;
    if (!key || key.startsWith('YOUR_') || key.startsWith('your-')) {
      throw new Error(
        'GeminiProvider requires a valid GEMINI_API_KEY environment variable. Please set it in .env.local.'
      );
    }
    this.client = new GoogleGenAI({ apiKey: key });
  }

  async generateText(
    messages: AIMessage[],
    options?: AIGenerationOptions
  ): Promise<AITextResponse> {
    const model = options?.model || AI_CONFIG.gemini.defaultModel;
    const systemInstruction = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');

    const conversationContents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => m.content)
      .join('\n\n');

    const response = await this.client.models.generateContent({
      model,
      contents: conversationContents,
      config: {
        systemInstruction: systemInstruction || undefined,
        temperature: options?.temperature ?? AI_CONFIG.gemini.temperature,
        maxOutputTokens: options?.maxTokens ?? AI_CONFIG.gemini.maxOutputTokens,
      },
    });

    const text = response.text || '';
    const usage = response.usageMetadata
      ? {
          promptTokens: response.usageMetadata.promptTokenCount || 0,
          completionTokens: response.usageMetadata.candidatesTokenCount || 0,
          totalTokens: response.usageMetadata.totalTokenCount || 0,
        }
      : undefined;

    return { text, usage };
  }

  async generateStructured<T>(
    messages: AIMessage[],
    schemaDescription: string,
    options?: AIGenerationOptions
  ): Promise<AIStructuredResponse<T>> {
    const model = options?.model || AI_CONFIG.gemini.defaultModel;
    const systemInstruction = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');

    const promptBody = messages
      .filter((m) => m.role !== 'system')
      .map((m) => m.content)
      .join('\n\n');

    // Combine schema guidance into instructions
    const fullSystemInstruction = `${systemInstruction}\n\n[Schema Description]:\n${schemaDescription}`;

    const response = await this.client.models.generateContent({
      model,
      contents: promptBody,
      config: {
        systemInstruction: fullSystemInstruction,
        responseMimeType: 'application/json',
        temperature: options?.temperature ?? AI_CONFIG.gemini.temperature,
        maxOutputTokens: options?.maxTokens ?? AI_CONFIG.gemini.maxOutputTokens,
      },
    });

    let raw = (response.text || '{}').trim();
    if (raw.startsWith('```json')) {
      raw = raw.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
    } else if (raw.startsWith('```')) {
      raw = raw.replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
    }

    let data: T;

    try {
      data = JSON.parse(raw) as T;
    } catch (parseError) {
      console.error('[ContentOS] [Gemini] JSON Parse Error. Raw length:', raw.length, 'Preview:', raw.slice(0, 300));
      throw new Error(
        `Failed to parse model structured JSON output: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`
      );
    }

    const usage = response.usageMetadata
      ? {
          promptTokens: response.usageMetadata.promptTokenCount || 0,
          completionTokens: response.usageMetadata.candidatesTokenCount || 0,
          totalTokens: response.usageMetadata.totalTokenCount || 0,
        }
      : undefined;

    return { data, raw, usage };
  }
}
