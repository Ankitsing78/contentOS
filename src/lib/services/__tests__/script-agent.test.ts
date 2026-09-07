/**
 * ContentOS - Script Agent, Timing Engine & Schema Unit Test Suite
 */

import {
  ScriptPlanSchema,
  ScriptSectionSchema,
  PlatformScriptVariantSchema,
  ScriptPackageSchema,
} from '../../ai/schema/script';
import {
  calculateWordCount,
  estimateDurationSeconds,
  alignSectionTimestamps,
  validateScriptTiming,
} from '../../script/timing';
import { ScriptAgent } from '../script-agent';
import { ContentBrief, ResearchPackage, ScriptSection } from '@/types';
import { IAIProvider } from '../../ai/provider';

async function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✓ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`✗ [FAIL] ${testName}`);
      failed++;
    }
  }

  console.log('\n======================================================');
  console.log('  ContentOS Script Agent, Timing & Schema Test Suite');
  console.log('======================================================\n');

  // 1. Timing Engine Tests
  console.log('--- 1. Timing Engine Tests ---');
  const sampleText = 'This is a test script for timing verification.';
  const wc = calculateWordCount(sampleText);
  assert(wc === 8, `Word count calculated accurately (expected 8, got ${wc})`);

  // 150 words at 150 WPM = exactly 60 seconds
  const words150 = new Array(150).fill('word').join(' ');
  const dur60 = estimateDurationSeconds(words150, 150);
  assert(dur60 === 60, `150 words at 150 WPM estimates to 60 seconds (got ${dur60})`);

  // Test section timestamp alignment
  const rawSections: ScriptSection[] = [
    {
      order: 1,
      type: 'hook',
      start_second: 0,
      end_second: 10,
      spoken_text: 'Stop scrolling if you write software. AI code generation is causing hidden architectural degradation.',
      visual_direction: 'Fast cuts of code redlines and bug counters.',
      b_roll_suggestions: ['Terminal git blame diff'],
      on_screen_text: 'The AI Code Quality Paradox',
      source_references: [],
    },
    {
      order: 2,
      type: 'evidence',
      start_second: 10,
      end_second: 30,
      spoken_text: 'A comprehensive study of over 150 million code lines showed code churn doubled since AI assistants became standard.',
      visual_direction: 'Data visualization graph of code churn spike.',
      b_roll_suggestions: ['GitClear chart'],
      on_screen_text: 'Code Churn +100%',
      source_references: [],
    },
    {
      order: 3,
      type: 'cta',
      start_second: 30,
      end_second: 60,
      spoken_text: 'Follow ContentOS for verified autonomous workflow architectures and deep technical breakdowns.',
      visual_direction: 'Host on camera pointing to subscribe button.',
      b_roll_suggestions: [],
      on_screen_text: 'Follow for more deep dives',
      source_references: [],
    },
  ];

  const aligned = alignSectionTimestamps(rawSections, 60);
  assert(aligned.length === 3, 'Aligned sections length preserved');
  assert(aligned[0].start_second === 0, 'First section starts at second 0');
  assert(aligned[2].end_second === 60, 'Last section terminates exactly at target duration (60s)');
  assert(
    aligned[0].end_second === aligned[1].start_second &&
    aligned[1].end_second === aligned[2].start_second,
    'Section boundaries are strictly contiguous with zero overlap or gaps'
  );

  const timingValidationShort = validateScriptTiming(aligned, 17);
  assert(timingValidationShort.isValid, 'validateScriptTiming confirms valid coverage for matching duration (~17s)');

  const timingValidationDeviant = validateScriptTiming(aligned, 60);
  assert(!timingValidationDeviant.isValid, 'validateScriptTiming flags significant pacing deviation (42 words vs 60s target)');

  // 2. Schema Validation Tests
  console.log('\n--- 2. Zod Schema Validation Tests ---');
  const validPlan = {
    narrative_goal: 'Explain the counter-intuitive rise in code churn despite AI speed claims',
    audience: 'Senior Software Engineers & Architects',
    opening_strategy: 'Start with the paradox: 50% faster coding vs 2x churn',
    key_sections: [
      {
        title: 'The Velocity Illusion',
        section_type: 'hook' as const,
        estimated_duration_seconds: 10,
        evidence_points: ['GitClear 153M lines analysis'],
        visual_idea: 'Split screen of developer vs AI terminal',
      },
      {
        title: 'The Hard Data',
        section_type: 'evidence' as const,
        estimated_duration_seconds: 35,
        evidence_points: ['Duplicated code and churn doubled'],
        visual_idea: 'Graph animation',
      },
      {
        title: 'Actionable Advice',
        section_type: 'cta' as const,
        estimated_duration_seconds: 15,
        evidence_points: [],
        visual_idea: 'Host direct to camera',
      },
    ],
    cta_strategy: 'Direct viewers to subscribe for autonomous engineering frameworks',
    platform_adjustments: {
      instagram: 'Vertical 9:16 framing with high contrast subtitles',
      youtube: 'Shorts shelf format with study link in description',
      x: 'Punchy thread summary accompanying the clip',
    },
  };

  const planParse = ScriptPlanSchema.safeParse(validPlan);
  assert(planParse.success, 'Valid ScriptPlan passes validation');

  const invalidPlan = {
    narrative_goal: '', // empty narrative goal
    audience: 'Engineers',
    opening_strategy: 'Hook',
    key_sections: [], // empty key_sections
    cta_strategy: 'CTA',
  };
  const invalidPlanParse = ScriptPlanSchema.safeParse(invalidPlan);
  assert(!invalidPlanParse.success, 'Invalid ScriptPlan is rejected');

  const validSection = {
    order: 1,
    type: 'hook' as const,
    start_second: 0,
    end_second: 8,
    spoken_text: 'Are AI code assistants actually creating tech debt?',
    visual_direction: 'Close-up on terminal with failing test suite.',
    b_roll_suggestions: ['Git blame scrolling quickly'],
    on_screen_text: 'Tech Debt vs Velocity',
    source_references: [
      {
        claim: 'Code churn rose after AI adoption',
        source_title: 'GitClear Study',
        source_url: 'https://gitclear.com/research/copilot_data_report_2024',
      },
    ],
  };
  const sectionParse = ScriptSectionSchema.safeParse(validSection);
  assert(sectionParse.success, 'Valid ScriptSection passes validation');

  const validVariant = {
    platform: 'instagram' as const,
    title: 'The Hidden Cost of AI Code Gen',
    format: 'short_video' as const,
    target_duration_seconds: 60,
    estimated_duration_seconds: 58,
    word_count: 145,
    hook: 'Stop letting AI write your entire codebase.',
    cta: 'Follow ContentOS for real benchmarks.',
    sections: [validSection],
    source_references: validSection.source_references,
    platform_adjustments: 'Vertical framing, high contrast subtitles',
  };
  const variantParse = PlatformScriptVariantSchema.safeParse(validVariant);
  assert(variantParse.success, 'Valid PlatformScriptVariant passes validation');

  // 3. ScriptAgent Workflow & Evidence Sourcing Tests
  console.log('\n--- 3. ScriptAgent Workflow & Evidence Sourcing Tests ---');

  const mockBrief: ContentBrief = {
    title: 'AI Code Assistant Impact Analysis',
    summary: 'A deep dive into code quality and churn metrics in modern AI-assisted teams.',
    topic: 'Software Engineering',
    audience: 'Senior Developers & Tech Leads',
    content_goal: 'Educational / Thought Leadership',
    angle: 'Contrarian analysis of developer velocity claims',
    hook: 'AI tools make you code 50% faster—so why is code churn doubling?',
    tone: 'Authoritative, analytical, engaging',
    key_points: ['GitClear analyzed 153M lines of code', 'Churn and duplicated code rose sharply'],
    suggested_formats: ['Short video', 'Carousel'],
    platforms: ['instagram', 'youtube', 'x'],
    needs_research: true,
  };

  const realTavilyUrl = 'https://gitclear.com/research/copilot_data_report_2024';
  const hallucinatedUrl = 'https://hallucinated-ai-fake-news.com/fake-article';

  const mockResearchPackage: ResearchPackage = {
    plan: {
      research_questions: ['What is the measured impact of Copilot on code churn?'],
      claims_to_verify: ['Code churn has doubled with AI assistants'],
      facts_needed: ['GitClear 2024 report findings'],
      source_requirements: ['Primary studies'],
      freshness_requirements: 'Within 24 months',
      research_priority: 'high',
    },
    sources: [
      {
        url: realTavilyUrl,
        title: 'GitClear 2024 AI Code Quality Report',
        source_type: 'report',
        credibility: 'high',
        relevance: 'high',
        publisher: 'GitClear',
        retrieved_at: new Date().toISOString(),
        published_at: '2024-01-15',
        evidence_summary: 'Code churn rose drastically as copy-paste style code increased.',
      },
    ],
    evidence: [
      {
        claim: 'Code churn has increased significantly with generative AI.',
        source: realTavilyUrl,
        supporting_excerpt: 'Our analysis of 153 million changed lines shows duplicated code and churn rates doubled.',
        confidence: 'high',
      },
    ],
    unresolved_questions: [],
    overall_confidence: 'high',
    isMockData: false, // Real Tavily web research
  };

  // Mock AI Provider simulating Phase 1 and Phase 2 structured responses
  let callCount = 0;
  const mockAIProvider: IAIProvider = {
    id: 'gemini',
    async generateText() {
      return { text: '' };
    },
    async generateStructured<T>() {
      callCount++;
      if (callCount === 1) {
        // Phase 1: Script Plan
        return {
          data: validPlan as unknown as T,
          raw: JSON.stringify(validPlan),
        };
      }
      // Phase 2: Master Script & Platform Variants
      const draftResult = {
        master_script: {
          title: 'The AI Code Quality Paradox',
          hook: 'AI tools make you code 50% faster—so why is code churn doubling?',
          cta: 'Follow ContentOS for production architecture deep dives.',
          tone: 'Authoritative, engaging',
          sections: [
            {
              order: 1,
              type: 'hook',
              start_second: 0,
              end_second: 10,
              spoken_text: 'AI tools make you code 50% faster—so why is code churn doubling?',
              visual_direction: 'Host in front of terminal, red code diff overlays.',
              b_roll_suggestions: ['Git log terminal animation'],
              on_screen_text: 'Why is Code Churn Doubling?',
              source_references: [
                {
                  claim: 'Code churn doubled',
                  source_title: 'GitClear 2024 AI Code Quality Report',
                  source_url: realTavilyUrl,
                  usage_note: 'Verified from primary study',
                },
                {
                  claim: 'Fabricated non-existent point',
                  source_title: 'Hallucinated Fake Source',
                  source_url: hallucinatedUrl, // Hallucination!
                },
              ],
            },
            {
              order: 2,
              type: 'evidence',
              start_second: 10,
              end_second: 45,
              spoken_text: 'A study of over 150 million lines revealed that duplicated code and churn surged right as AI adoption peaked.',
              visual_direction: 'Data graph showing churn rising from 2021 to 2024.',
              b_roll_suggestions: ['GitClear graph overlay'],
              on_screen_text: '153M Lines Analyzed',
              source_references: [
                {
                  claim: '153M lines analyzed',
                  source_title: 'GitClear 2024 AI Code Quality Report',
                  source_url: realTavilyUrl,
                },
              ],
            },
            {
              order: 3,
              type: 'cta',
              start_second: 45,
              end_second: 60,
              spoken_text: 'Before trusting AI for mission-critical code, establish automated architectural testing. Follow for more deep dives.',
              visual_direction: 'Host direct to camera with ContentOS logo overlay.',
              b_roll_suggestions: ['Architecture diagram flow'],
              on_screen_text: 'Follow ContentOS',
              source_references: [],
            },
          ],
        },
        platform_variants: [
          {
            platform: 'instagram',
            title: 'The AI Code Quality Paradox (Reel)',
            hook: 'Stop letting AI write your entire codebase blindly.',
            cta: 'Link in bio for full study breakdown.',
            platform_adjustments: 'Vertical 9:16 framing with bold kinetic subtitles',
            sections: [
              {
                order: 1,
                type: 'hook',
                start_second: 0,
                end_second: 10,
                spoken_text: 'Stop letting AI write your entire codebase blindly.',
                visual_direction: 'Vertical 9:16 terminal frame with neon warning sign.',
                b_roll_suggestions: [],
                on_screen_text: 'Watch this before using Copilot',
                source_references: [
                  {
                    claim: 'Study shows quality drop',
                    source_title: 'GitClear 2024 AI Code Quality Report',
                    source_url: realTavilyUrl,
                  },
                ],
              },
            ],
          },
          {
            platform: 'youtube',
            title: 'AI Code Generation: The 153M Line Study (Shorts)',
            hook: 'Is AI code making your repo worse?',
            cta: 'Subscribe for autonomous engineering breakdowns.',
            platform_adjustments: 'Shorts shelf format, pinned comment study link',
            sections: [
              {
                order: 1,
                type: 'hook',
                start_second: 0,
                end_second: 10,
                spoken_text: 'Is AI code making your repo worse than before?',
                visual_direction: 'High-contrast studio lighting',
                b_roll_suggestions: [],
                on_screen_text: 'Is AI Code Worse?',
                source_references: [],
              },
            ],
          },
          {
            platform: 'x',
            title: 'The AI Code Churn Paradox (Post)',
            hook: 'AI code churn is up 100%. Here is the data:',
            cta: 'Reposter and follow for more technical deep dives.',
            platform_adjustments: 'Thread format with high-signal stats in opening line',
            sections: [
              {
                order: 1,
                type: 'hook',
                start_second: 0,
                end_second: 15,
                spoken_text: 'AI code churn is up 100%. Here is what 153 million lines of code tell us.',
                visual_direction: 'Square code snippet graphic',
                b_roll_suggestions: [],
                on_screen_text: 'Code Churn +100%',
                source_references: [],
              },
            ],
          },
        ],
        consistency_notes: 'All platform variants preserve the core 153M lines research finding.',
        unsupported_claims: [],
        overall_confidence: 'high',
      };

      return {
        data: draftResult as unknown as T,
        raw: JSON.stringify(draftResult),
      };
    },
  };

  const scriptAgent = new ScriptAgent(mockAIProvider);
  const scriptResult = await scriptAgent.execute({
    brief: mockBrief,
    researchPackage: mockResearchPackage,
    platforms: ['instagram', 'youtube', 'x'],
    format: 'short_video',
    durationSeconds: 60,
  });

  assert(scriptResult.package !== null, 'ScriptAgent produces a valid ScriptPackage');
  assert(scriptResult.plan.key_sections.length === 3, 'Phase 1 plan sections preserved');
  assert(scriptResult.package.is_mock_data === false, 'Real research data status (is_mock_data: false) is preserved on script package');

  // Verify citation filtering: hallucinated URL must have been stripped
  const hookSection = scriptResult.package.master_script.sections[0];
  const hookUrls = hookSection.source_references.map((r) => r.source_url);
  assert(
    hookUrls.includes(realTavilyUrl),
    'Legitimate Tavily research source URL is preserved in section source_references'
  );
  assert(
    !hookUrls.includes(hallucinatedUrl),
    'Hallucinated URL was strictly stripped out by citation verification filter'
  );

  // Verify platform variants generated
  const variants = scriptResult.package.platform_variants;
  assert(variants.length === 3, `All 3 requested platform variants generated (count: ${variants.length})`);
  const platforms = variants.map((v) => v.platform);
  assert(
    platforms.includes('instagram') && platforms.includes('youtube') && platforms.includes('x'),
    'Variants include instagram, youtube, and x'
  );

  // Verify whole package passes Zod validation
  const fullPkgValidate = ScriptPackageSchema.safeParse(scriptResult.package);
  assert(fullPkgValidate.success, 'Complete ScriptPackage passes strict Zod validation');

  console.log('\n======================================================');
  console.log(`Results: ${passed} passed, ${failed} failed.`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
