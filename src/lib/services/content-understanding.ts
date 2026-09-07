/**
 * ContentOS - Content Understanding Agent Service
 * Orchestrates prompt formulation, AI invocation, and strict schema validation.
 */

import { IAIProvider, getAIProvider } from '@/lib/ai/provider';
import {
  CONTENT_UNDERSTANDING_SYSTEM_PROMPT,
  buildContentUnderstandingPrompt,
} from '@/lib/ai/prompts/content-understanding';
import {
  ContentBriefSchema,
  ValidatedContentBrief,
} from '@/lib/ai/schema/content-understanding';
import { AIMessage } from '@/types';

export interface ContentUnderstandingInput {
  userInput: string;
  inputType?: 'text' | 'audio' | 'file';
  userContext?: string;
  aiProvider?: IAIProvider;
}

export interface ContentUnderstandingAgentResult {
  brief: ValidatedContentBrief;
  rawJson: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class ContentUnderstandingAgent {
  private provider: IAIProvider;

  constructor(customProvider?: IAIProvider) {
    this.provider = customProvider || getAIProvider('gemini');
  }

  /**
   * Executes the Content Understanding Agent workflow.
   * Pure service logic: receives input, returns validated ContentBrief.
   */
  async execute(input: ContentUnderstandingInput): Promise<ContentUnderstandingAgentResult> {
    const inputType = input.inputType || 'text';
    const userPrompt = buildContentUnderstandingPrompt(
      input.userInput,
      inputType,
      input.userContext
    );

    const messages: AIMessage[] = [
      {
        role: 'system',
        content: CONTENT_UNDERSTANDING_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ];

    // Schema description to reinforce the model's structural adherence
    const schemaDescription = `Return a JSON object conforming strictly to the ContentBrief schema with fields:
- title (string, 3-150 chars)
- summary (string, 10-1000 chars)
- topic (string, 2-100 chars)
- audience (string, 3-200 chars)
- content_goal (string, 5-250 chars)
- angle (string, 5-300 chars)
- hook (string, 5-250 chars)
- tone (string, 3-100 chars)
- key_points (array of non-empty strings)
- suggested_formats (array of strings, e.g. "60-second Reel", "YouTube Video")
- platforms (array with subset of: "youtube", "instagram", "x")
- needs_research (boolean)`;

    // 1. Invoke model with structured response
    const response = await this.provider.generateStructured<Record<string, unknown>>(
      messages,
      schemaDescription
    );

    // 2. Strictly validate output using Zod schema
    const validationResult = ContentBriefSchema.safeParse(response.data);

    if (!validationResult.success) {
      const issueDetails = validationResult.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      throw new Error(`Content Brief validation failed: ${issueDetails}`);
    }

    return {
      brief: validationResult.data,
      rawJson: response.raw,
      usage: response.usage,
    };
  }
}
