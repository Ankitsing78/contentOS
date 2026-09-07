/**
 * ContentOS - Script Agent Service
 * 
 * Orchestrates Phase 1 (Script Planning) and Phase 2 (Evidence-backed Master Script & Platform Variants).
 * Enforces citation verification, contiguous timing alignment, and Zod validation.
 */

import { IAIProvider, getAIProvider } from '@/lib/ai/provider';
import {
  SCRIPT_AGENT_SYSTEM_PROMPT,
  buildScriptPlanPrompt,
  buildScriptDraftPrompt,
} from '@/lib/ai/prompts/script-agent';
import {
  ScriptPlanSchema,
  ScriptPackageSchema,
  ValidatedScriptPlan,
  ValidatedScriptPackage,
  ValidatedScriptSection,
  ValidatedScriptSourceReference,
} from '@/lib/ai/schema/script';
import {
  alignSectionTimestamps,
  calculateWordCount,
  estimateDurationSeconds,
  DEFAULT_WORDS_PER_MINUTE,
} from '@/lib/script/timing';
import {
  ContentBrief,
  ResearchPackage,
  PlatformType,
  AIMessage,
  ScriptFormat,
} from '@/types';

export interface ScriptAgentInput {
  brief: ContentBrief;
  researchPackage: ResearchPackage;
  projectId?: string;
  jobId?: string;
  platforms?: PlatformType[];
  format?: ScriptFormat;
  durationSeconds?: number;
  aiProvider?: IAIProvider;
  wpm?: number;
}

export interface ScriptAgentResult {
  package: ValidatedScriptPackage;
  rawJson?: string;
  plan: ValidatedScriptPlan;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

interface RawDraftResponse {
  master_script: {
    title: string;
    hook: string;
    cta: string;
    tone?: string;
    sections: Array<{
      order?: number;
      type: string;
      start_second?: number;
      end_second?: number;
      spoken_text: string;
      visual_direction?: string;
      b_roll_suggestions?: string[];
      on_screen_text?: string;
      source_references?: Array<{
        claim: string;
        source_title: string;
        source_url?: string;
        usage_note?: string;
      }>;
    }>;
  };
  platform_variants?: Array<{
    platform: string;
    title: string;
    hook: string;
    cta: string;
    platform_adjustments?: string;
    sections: Array<{
      order?: number;
      type: string;
      start_second?: number;
      end_second?: number;
      spoken_text: string;
      visual_direction?: string;
      b_roll_suggestions?: string[];
      on_screen_text?: string;
      source_references?: Array<{
        claim: string;
        source_title: string;
        source_url?: string;
        usage_note?: string;
      }>;
    }>;
  }>;
  consistency_notes?: string;
  unsupported_claims?: string[];
  overall_confidence?: 'low' | 'medium' | 'high';
}

export class ScriptAgent {
  private aiProvider: IAIProvider;
  private wpm: number;

  constructor(customAIProvider?: IAIProvider, wpm?: number) {
    this.aiProvider = customAIProvider || getAIProvider('gemini');
    this.wpm = wpm || DEFAULT_WORDS_PER_MINUTE;
  }

  /**
   * Executes the end-to-end Script Agent workflow.
   */
  async execute(input: ScriptAgentInput): Promise<ScriptAgentResult> {
    const { brief, researchPackage, projectId = '' } = input;
    const ai = input.aiProvider || this.aiProvider;
    const wpm = input.wpm || this.wpm;
    const platforms = input.platforms && input.platforms.length > 0
      ? input.platforms
      : ((brief.platforms as PlatformType[]) || ['instagram', 'youtube', 'x']);
    const targetDurationSeconds = input.durationSeconds || 60;
    const format = input.format || 'short_video';

    console.log('[ContentOS] [ScriptAgent] Phase 1: Formulating Script Plan');

    // 1. Phase 1: Script Planning via Gemini
    const planPrompt = buildScriptPlanPrompt(brief, researchPackage, platforms, targetDurationSeconds);
    const planMessages: AIMessage[] = [
      { role: 'system', content: SCRIPT_AGENT_SYSTEM_PROMPT },
      { role: 'user', content: planPrompt },
    ];

    const planSchemaDescription = `Return a JSON object conforming to:
{
  "narrative_goal": string,
  "audience": string,
  "opening_strategy": string,
  "key_sections": [
    {
      "title": string,
      "section_type": "hook" | "intro" | "problem" | "evidence" | "counter_argument" | "resolution" | "cta",
      "estimated_duration_seconds": number,
      "evidence_points": string[],
      "visual_idea": string
    }
  ],
  "cta_strategy": string,
  "platform_adjustments": { [platform: string]: string }
}`;

    const planResponse = await ai.generateStructured<unknown>(planMessages, planSchemaDescription, {
      maxTokens: 4096,
    });
    const planParsed = ScriptPlanSchema.safeParse(planResponse.data);

    if (!planParsed.success) {
      const issue = planParsed.error.issues[0]?.message || 'Plan validation failed';
      console.error('[ContentOS] Script plan validation error:', issue);
      throw new Error(`AI generated an invalid Script Plan: ${issue}`);
    }

    const plan: ValidatedScriptPlan = planParsed.data;
    console.log('[ContentOS] [ScriptAgent] Phase 1 complete. Sections planned:', plan.key_sections.length);

    // 2. Phase 2: Master Script & Platform Variants Generation
    console.log('[ContentOS] [ScriptAgent] Phase 2: Drafting Master Script & Platform Variants');
    const draftPrompt = buildScriptDraftPrompt(
      plan,
      brief,
      researchPackage,
      platforms,
      targetDurationSeconds,
      format
    );

    const draftMessages: AIMessage[] = [
      { role: 'system', content: SCRIPT_AGENT_SYSTEM_PROMPT },
      { role: 'user', content: draftPrompt },
    ];

    const draftSchemaDescription = `Return a JSON object conforming to:
{
  "master_script": {
    "title": string,
    "hook": string,
    "cta": string,
    "tone": string,
    "sections": [
      {
        "order": number,
        "type": "hook" | "intro" | "problem" | "evidence" | "counter_argument" | "resolution" | "cta",
        "start_second": number,
        "end_second": number,
        "spoken_text": string,
        "visual_direction": string,
        "b_roll_suggestions": string[],
        "on_screen_text": string,
        "source_references": [
          { "claim": string, "source_title": string, "source_url": string, "usage_note": string }
        ]
      }
    ]
  },
  "platform_variants": [
    {
      "platform": "youtube" | "instagram" | "x",
      "title": string,
      "hook": string,
      "cta": string,
      "platform_adjustments": string,
      "sections": [
        {
          "order": number,
          "type": "hook" | "intro" | "problem" | "evidence" | "counter_argument" | "resolution" | "cta",
          "start_second": number,
          "end_second": number,
          "spoken_text": string,
          "visual_direction": string,
          "b_roll_suggestions": string[],
          "on_screen_text": string,
          "source_references": [
            { "claim": string, "source_title": string, "source_url": string }
          ]
        }
      ]
    }
  ],
  "consistency_notes": string,
  "unsupported_claims": string[],
  "overall_confidence": "low" | "medium" | "high"
}`;

    const draftResponse = await ai.generateStructured<RawDraftResponse>(
      draftMessages,
      draftSchemaDescription,
      { maxTokens: 8192 }
    );
    const draftData = draftResponse.data;

    // 3. Post-Processing & Citation Verification
    // Collect valid sources from research package for citation validation
    const validSources = researchPackage.sources || [];
    const validUrlsSet = new Set(validSources.map((s) => s.url.toLowerCase().trim()));
    const validTitlesSet = new Set(validSources.map((s) => s.title.toLowerCase().trim()));

    const sanitizeSourceReferences = (
      refs?: Array<{ claim: string; source_title: string; source_url?: string; usage_note?: string }>
    ): ValidatedScriptSourceReference[] => {
      if (!Array.isArray(refs)) return [];
      const sanitized: ValidatedScriptSourceReference[] = [];

      for (const r of refs) {
        const urlMatch = r.source_url && validUrlsSet.has(r.source_url.toLowerCase().trim());
        const titleMatch = r.source_title && validTitlesSet.has(r.source_title.toLowerCase().trim());

        // Locate matched source object if any
        const matchedSource = validSources.find(
          (s) =>
            (r.source_url && s.url.toLowerCase().trim() === r.source_url.toLowerCase().trim()) ||
            (r.source_title && s.title.toLowerCase().trim() === r.source_title.toLowerCase().trim())
        );

        if (urlMatch || titleMatch || matchedSource) {
          sanitized.push({
            source_id: undefined, // Will be bound to UUID during Supabase persistence
            claim: r.claim || 'Research-backed point',
            source_title: matchedSource?.title || r.source_title || 'Retrieved Web Document',
            source_url: matchedSource?.url || r.source_url || '',
            usage_note: r.usage_note,
          });
        } else {
          console.warn('[ContentOS] Discarded hallucinated source reference in script:', r.source_title);
        }
      }

      return sanitized;
    };

    const processSections = (
      rawSections?: Array<{
        type: string;
        spoken_text: string;
        visual_direction?: string;
        b_roll_suggestions?: string[];
        on_screen_text?: string;
        source_references?: Array<{ claim: string; source_title: string; source_url?: string; usage_note?: string }>;
      }>
    ): ValidatedScriptSection[] => {
      if (!Array.isArray(rawSections) || rawSections.length === 0) {
        // Fallback: minimal valid section
        return [
          {
            order: 1,
            type: 'hook',
            start_second: 0,
            end_second: targetDurationSeconds,
            spoken_text: brief.hook || brief.title,
            visual_direction: 'Talking head delivering hook with conviction',
            b_roll_suggestions: [],
            source_references: [],
          },
        ];
      }

      const parsed: ValidatedScriptSection[] = rawSections.map((sec, idx) => {
        const validType = [
          'hook',
          'intro',
          'problem',
          'evidence',
          'counter_argument',
          'resolution',
          'cta',
        ].includes(sec.type)
          ? (sec.type as ValidatedScriptSection['type'])
          : 'evidence';

        return {
          order: idx + 1,
          type: validType,
          start_second: 0,
          end_second: 1,
          spoken_text: sec.spoken_text || 'Core insight',
          visual_direction: sec.visual_direction || 'Talking head to camera',
          b_roll_suggestions: sec.b_roll_suggestions || [],
          on_screen_text: sec.on_screen_text || undefined,
          source_references: sanitizeSourceReferences(sec.source_references),
        };
      });

      // Align contiguous non-overlapping section timestamps
      return alignSectionTimestamps(parsed, targetDurationSeconds, wpm) as ValidatedScriptSection[];
    };

    // 4. Assemble Master Script
    const masterSections = processSections(draftData.master_script?.sections);
    const masterFullSpokenText = masterSections.map((s) => s.spoken_text).join(' ');
    const masterWordCount = calculateWordCount(masterFullSpokenText);
    const masterEstimatedDuration = estimateDurationSeconds(masterFullSpokenText, wpm);

    // Collect all unique source references in master script
    const masterAllRefs: ValidatedScriptSourceReference[] = [];
    masterSections.forEach((sec) => sec.source_references.forEach((r) => masterAllRefs.push(r)));

    const masterScript = {
      project_id: projectId,
      job_id: input.jobId,
      title: draftData.master_script?.title || brief.title,
      format,
      platform: 'master' as const,
      target_duration_seconds: targetDurationSeconds,
      estimated_duration_seconds: masterEstimatedDuration,
      word_count: masterWordCount,
      language: 'en',
      tone: brief.tone || draftData.master_script?.tone || 'Engaging and authoritative',
      hook: draftData.master_script?.hook || brief.hook,
      sections: masterSections,
      cta: draftData.master_script?.cta || 'Follow for more insights.',
      source_references: masterAllRefs,
      unresolved_claims: draftData.unsupported_claims || researchPackage.unresolved_questions || [],
      generated_at: new Date().toISOString(),
      version: 1,
      is_mock_data: researchPackage.isMockData === true,
    };

    // 5. Assemble Platform Variants
    const platformVariants = (draftData.platform_variants || []).map((pv) => {
      const validPlatform = (['youtube', 'instagram', 'x'].includes(pv.platform)
        ? pv.platform
        : 'instagram') as PlatformType;

      const variantSections = processSections(pv.sections);
      const variantSpoken = variantSections.map((s) => s.spoken_text).join(' ');
      const variantWordCount = calculateWordCount(variantSpoken);
      const variantEstimatedDuration = estimateDurationSeconds(variantSpoken, wpm);

      const variantAllRefs: ValidatedScriptSourceReference[] = [];
      variantSections.forEach((sec) => sec.source_references.forEach((r) => variantAllRefs.push(r)));

      return {
        platform: validPlatform,
        title: pv.title || `${masterScript.title} (${validPlatform})`,
        format,
        target_duration_seconds: targetDurationSeconds,
        estimated_duration_seconds: variantEstimatedDuration,
        word_count: variantWordCount,
        hook: pv.hook || masterScript.hook,
        cta: pv.cta || masterScript.cta,
        sections: variantSections,
        source_references: variantAllRefs,
        platform_adjustments: pv.platform_adjustments || `Tailored specifically for ${validPlatform}`,
      };
    });

    // 6. Assemble and Validate Final ScriptPackage
    const scriptPackagePayload = {
      master_script: masterScript,
      platform_variants: platformVariants,
      consistency_notes:
        draftData.consistency_notes ||
        'Master script grounded strictly on retrieved research evidence; tone matches original creative brief.',
      unsupported_claims: draftData.unsupported_claims || researchPackage.unresolved_questions || [],
      overall_confidence: draftData.overall_confidence || researchPackage.overall_confidence || 'medium',
      generated_at: new Date().toISOString(),
      is_mock_data: researchPackage.isMockData === true,
    };

    const packageParsed = ScriptPackageSchema.safeParse(scriptPackagePayload);
    if (!packageParsed.success) {
      const issue = packageParsed.error.issues[0]?.message || 'ScriptPackage validation failed';
      console.error('[ContentOS] ScriptPackage validation error:', issue);
      throw new Error(`Invalid assembled ScriptPackage: ${issue}`);
    }

    console.log(
      `[ContentOS] [ScriptAgent] Generated master script (${masterWordCount} words, ~${masterEstimatedDuration}s) with ${platformVariants.length} platform variants.`
    );

    return {
      package: packageParsed.data,
      rawJson: draftResponse.raw,
      plan,
      usage: draftResponse.usage,
    };
  }
}
