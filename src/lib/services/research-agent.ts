/**
 * ContentOS - Research Agent Service
 * 
 * Orchestrates Phase A (Research Planning via Gemini) and Phase B (Evidence Retrieval
 * via IResearchProvider). Employs strict Zod schema validation.
 */

import { IAIProvider, getAIProvider } from '@/lib/ai/provider';
import {
  RESEARCH_AGENT_SYSTEM_PROMPT,
  buildResearchPlanPrompt,
} from '@/lib/ai/prompts/research-agent';
import {
  ResearchPlanSchema,
  ResearchPackageSchema,
  ValidatedResearchPlan,
  ValidatedResearchPackage,
} from '@/lib/ai/schema/research';
import { IResearchProvider, getResearchProvider } from '@/lib/research';
import { ContentBrief, AIMessage } from '@/types';

export interface ResearchAgentInput {
  brief: ContentBrief;
  projectId?: string;
  jobId?: string;
  aiProvider?: IAIProvider;
  researchProvider?: IResearchProvider;
}

export interface ResearchAgentResult {
  package: ValidatedResearchPackage;
  rawJson?: string;
  skipped: boolean;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class ResearchAgent {
  private aiProvider: IAIProvider;
  private researchProvider: IResearchProvider;

  constructor(customAIProvider?: IAIProvider, customResearchProvider?: IResearchProvider) {
    this.aiProvider = customAIProvider || getAIProvider('gemini');
    this.researchProvider = customResearchProvider || getResearchProvider();
  }

  /**
   * Executes the Research Agent workflow.
   */
  async execute(input: ResearchAgentInput): Promise<ResearchAgentResult> {
    const { brief } = input;
    const ai = input.aiProvider || this.aiProvider;
    const retriever = input.researchProvider || this.researchProvider;

    // 1. Branch: If ContentBrief explicitly does not require research
    if (!brief.needs_research) {
      console.log('[ContentOS] research not required for brief; skipping research retrieval');
      const skippedPackage: ValidatedResearchPackage = {
        plan: {
          research_questions: ['No external research required for this creative brief'],
          claims_to_verify: [],
          facts_needed: [],
          source_requirements: [],
          freshness_requirements: 'N/A',
          research_priority: 'low',
        },
        sources: [],
        evidence: [],
        unresolved_questions: [],
        overall_confidence: 'high',
        isMockData: false,
      };

      return {
        package: skippedPackage,
        skipped: true,
      };
    }

    // 2. Phase A: Formulate Research Plan with Gemini
    console.log('[ContentOS] research planning started');
    const userPrompt = buildResearchPlanPrompt(brief);
    const messages: AIMessage[] = [
      { role: 'system', content: RESEARCH_AGENT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    const schemaDescription = `Return a JSON object conforming to:
{
  "research_questions": string[] (2-5 questions),
  "claims_to_verify": string[],
  "facts_needed": string[],
  "source_requirements": string[],
  "freshness_requirements": string,
  "research_priority": "low" | "medium" | "high"
}`;

    const aiResponse = await ai.generateStructured<unknown>(messages, schemaDescription);
    const parsePlanResult = ResearchPlanSchema.safeParse(aiResponse.data);

    if (!parsePlanResult.success) {
      const issue = parsePlanResult.error.issues[0]?.message || 'Schema validation failed';
      console.error('[ContentOS] Research plan validation error:', issue);
      throw new Error(`AI generated an invalid Research Plan: ${issue}`);
    }

    const plan: ValidatedResearchPlan = parsePlanResult.data;
    console.log('[ContentOS] research planning completed. Questions:', plan.research_questions.length);

    // 3. Phase B: Gather Evidence via IResearchProvider
    console.log('[ContentOS] research provider started:', retriever.name);
    const retrievalResult = await retriever.gatherEvidence(plan);
    console.log('[ContentOS] research provider completed. Sources found:', retrievalResult.sources.length);

    // 4. Assemble & Validate Full Research Package
    const fullPackageData = {
      plan,
      sources: retrievalResult.sources,
      evidence: retrievalResult.evidence,
      unresolved_questions: retrievalResult.unresolved_questions,
      overall_confidence: retrievalResult.overall_confidence,
      isMockData: retrievalResult.isMockData,
    };

    const packageParseResult = ResearchPackageSchema.safeParse(fullPackageData);
    if (!packageParseResult.success) {
      const issue = packageParseResult.error.issues[0]?.message || 'Package schema validation failed';
      console.error('[ContentOS] Research package validation error:', issue);
      throw new Error(`Invalid assembled Research Package: ${issue}`);
    }

    return {
      package: packageParseResult.data,
      rawJson: aiResponse.raw,
      skipped: false,
      usage: aiResponse.usage,
    };
  }
}
