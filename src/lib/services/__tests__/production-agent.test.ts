/**
 * ContentOS - Production & Media Planning Agent Unit Test Suite
 */

import {
  ProductionPackageSchema,
  VisualAssetRequirementSchema,
} from '../../ai/schema/production';
import { getPlatformProductionConfig } from '../../production/config';
import { generateCaptionBlocks } from '../../production/caption-timing';
import { ProductionAgent } from '../production-agent';
import { ContentBrief, ResearchPackage, AIStructuredResponse } from '@/types';
import { Script } from '@/types/script';
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
  console.log('  ContentOS Production / Media Planning Test Suite');
  console.log('======================================================\n');

  // 1. Platform Production Config Tests
  console.log('--- 1. Platform Production Config Tests ---');
  const igConfig = getPlatformProductionConfig('instagram', 'short_video');
  assert(igConfig.aspectRatio === '9:16', 'Instagram Reel aspect ratio is 9:16');
  assert(igConfig.resolution === '1080x1920', 'Instagram Reel resolution is 1080x1920');

  const ytConfig = getPlatformProductionConfig('youtube', 'short_video');
  assert(ytConfig.aspectRatio === '9:16', 'YouTube Short aspect ratio is 9:16');

  const xConfig = getPlatformProductionConfig('x', 'post');
  assert(xConfig.aspectRatio === '1:1', 'X post aspect ratio is 1:1');

  // 2. Caption Timing Engine Tests
  console.log('\n--- 2. Caption Timing Engine Tests ---');
  const sampleNarration = 'AI generated code creates 10x more boilerplate and architectural drift than handwritten modules.';
  const captions = generateCaptionBlocks({
    sceneId: 'scene-1',
    spokenText: sampleNarration,
    startSecond: 0,
    endSecond: 8.5,
    maxWordsPerBlock: 5,
  });

  assert(captions.length > 1, `Caption split into multiple readable cards (${captions.length} blocks)`);
  assert(captions[0].start_second === 0, 'First caption starts at 0.0s');
  assert(
    Math.abs(captions[captions.length - 1].end_second - 8.5) < 0.1,
    `Last caption ends at scene boundary (got ${captions[captions.length - 1].end_second}, expected ~8.5)`
  );
  assert(
    captions.every((c) => c.end_second >= c.start_second),
    'All captions have non-negative contiguous durations'
  );

  const emptyCaptions = generateCaptionBlocks({
    sceneId: 'scene-empty',
    spokenText: '',
    startSecond: 0,
    endSecond: 5,
  });
  assert(emptyCaptions.length === 0, 'Empty spoken text yields 0 caption blocks');

  // 3. Schema & Validation Rule Tests
  console.log('\n--- 3. Schema & Validation Rule Tests ---');
  const validVisual = {
    id: 'vis-1',
    scene_id: 'scene-1',
    asset_type: 'video_clip' as const,
    description: 'Talking head delivering hook',
    prompt: 'Cinematic developer at desk with warm rim light',
    aspect_ratio: '9:16' as const,
    resolution: '1080x1920',
    duration_seconds: 5.0,
    source: 'ai_generated' as const,
    generation_required: true,
    status: 'pending' as const,
  };
  const visualParse = VisualAssetRequirementSchema.safeParse(validVisual);
  assert(visualParse.success, 'Valid visual asset requirement passes schema');

  // Planning rule: assets requiring generation cannot be marked 'completed'
  const invalidCompletedPackage = {
    project_id: '11111111-1111-1111-1111-111111111111',
    platform: 'instagram' as const,
    format: 'short_video' as const,
    duration_seconds: 10,
    aspect_ratio: '9:16' as const,
    scenes: [
      {
        id: 'scene-1',
        order: 1,
        start_second: 0,
        end_second: 10,
        duration_seconds: 10,
        purpose: 'Deliver hook',
        spoken_text: 'Hello world',
        visual_type: 'talking_head' as const,
        visual_prompt: 'Test prompt',
        b_roll_requirement: 'None',
        camera_direction: 'Eye level',
        composition: 'Centered',
        caption_text: 'Hello world',
        source_references: [],
        visual_assets: [
          {
            ...validVisual,
            generation_required: true,
            status: 'completed' as const, // VIOLATION
          },
        ],
        audio_assets: [],
        captions: [],
      },
    ],
    narration_segments: [],
    visual_assets: [
      {
        ...validVisual,
        generation_required: true,
        status: 'completed' as const, // VIOLATION
      },
    ],
    audio_assets: [],
    overlays: [],
    captions: [],
    transitions: [],
    asset_checklist: [],
    production_notes: [],
    unresolved_requirements: [],
    confidence: 'high' as const,
    generated_at: new Date().toISOString(),
    version: 1,
    is_mock_data: false,
  };

  const completedPackageParse = ProductionPackageSchema.safeParse(invalidCompletedPackage);
  assert(
    !completedPackageParse.success,
    'Schema strictly rejects assets requiring generation marked as completed during planning phase'
  );

  // Timing gap rule: reject disconnected scenes
  const gapPackage = {
    ...invalidCompletedPackage,
    visual_assets: [validVisual],
    scenes: [
      {
        ...invalidCompletedPackage.scenes[0],
        visual_assets: [validVisual],
        start_second: 0,
        end_second: 5,
      },
      {
        ...invalidCompletedPackage.scenes[0],
        id: 'scene-2',
        order: 2,
        visual_assets: [validVisual],
        start_second: 8, // GAP OF 3 SECONDS
        end_second: 12,
      },
    ],
  };
  const gapPackageParse = ProductionPackageSchema.safeParse(gapPackage);
  assert(!gapPackageParse.success, 'Schema strictly rejects scenes with timing gaps');

  // 4. End-to-End Production Agent Service Execution
  console.log('\n--- 4. End-to-End Production Agent Service Execution ---');

  const mockBrief: ContentBrief = {
    title: 'Why AI Will Elevate Good Developers',
    summary: 'The shift from manual boilerplate typing to systems architecture.',
    topic: 'Software Engineering',
    audience: 'Professional software developers',
    content_goal: 'Explain the future of software engineering',
    angle: 'AI is a leveraged multiplier, not a replacement',
    hook: 'AI won’t take your coding job, but an architect using AI will.',
    tone: 'Authoritative, analytical, engaging',
    key_points: ['Boilerplate generation is commoditized', 'Architectural verification is king'],
    suggested_formats: ['Short-form Reel'],
    platforms: ['instagram', 'youtube', 'x'],
    needs_research: true,
  };

  const mockResearch: ResearchPackage = {
    plan: {
      research_questions: ['How does AI impact code quality?'],
      claims_to_verify: ['AI increases code volume but causes architecture degradation'],
      facts_needed: ['GitClear analysis statistics'],
      source_requirements: ['Peer-reviewed or verified industry report'],
      freshness_requirements: 'Last 12 months',
      research_priority: 'high',
    },
    sources: [
      {
        title: 'GitClear 2024 AI Code Quality Report',
        url: 'https://gitclear.com/research/ai-code-quality-2024',
        publisher: 'GitClear Research',
        published_at: '2024-01-15',
        retrieved_at: '2026-09-07',
        source_type: 'report',
        relevance: 'high',
        credibility: 'high',
        evidence_summary: 'Churn rate doubled with AI copilot usage.',
      },
    ],
    evidence: [
      {
        claim: 'AI generated code increases code churn significantly.',
        source: 'GitClear 2024 AI Code Quality Report',
        supporting_excerpt: 'Projected code churn doubled in repos with heavy AI assistant adoption.',
        confidence: 'high',
      },
    ],
    unresolved_questions: [],
    overall_confidence: 'high',
    isMockData: false,
  };

  const mockScript: Script = {
    project_id: 'test-project',
    title: 'Why AI Will Elevate Good Developers (Instagram)',
    format: 'short_video',
    platform: 'instagram',
    target_duration_seconds: 60,
    estimated_duration_seconds: 58,
    word_count: 145,
    language: 'en',
    tone: 'Authoritative',
    hook: 'AI will not replace good engineers; it will automate bad ones.',
    cta: 'Follow for more deep architectural insights.',
    version: 1,
    is_mock_data: false,
    sections: [
      {
        order: 1,
        type: 'hook',
        start_second: 0,
        end_second: 8.0,
        spoken_text: 'Stop worrying that AI will take your software engineering career.',
        visual_direction: 'Talking head with confident expression directly to camera',
        b_roll_suggestions: [],
        on_screen_text: 'The AI Engineering Paradox',
        source_references: [],
      },
      {
        order: 2,
        type: 'problem',
        start_second: 8.0,
        end_second: 24.0,
        spoken_text: 'According to GitClear research, AI generated code has doubled code churn and duplication across thousands of repositories.',
        visual_direction: 'Terminal diff with red lines showing code churn',
        b_roll_suggestions: ['Git diff graph', 'Terminal output'],
        source_references: [
          {
            claim: 'AI generated code increases code churn',
            source_title: 'GitClear 2024 AI Code Quality Report',
            source_url: 'https://gitclear.com/research/ai-code-quality-2024',
          },
        ],
      },
      {
        order: 3,
        type: 'resolution',
        start_second: 24.0,
        end_second: 50.0,
        spoken_text: 'The developers who succeed are not syntax typists; they are system architects who verify and design resilient systems.',
        visual_direction: 'Architecture diagram animation showing modular services',
        b_roll_suggestions: [],
        source_references: [],
      },
      {
        order: 4,
        type: 'cta',
        start_second: 50.0,
        end_second: 60.0,
        spoken_text: 'Level up your system architecture skills. Drop your thoughts below and follow for more.',
        visual_direction: 'Talking head with comment callout animation',
        b_roll_suggestions: [],
        on_screen_text: 'Comment Your View Below',
        source_references: [],
      },
    ],
    source_references: [],
    unresolved_claims: [],
    generated_at: new Date().toISOString(),
  };

  const mockAIProvider: IAIProvider = {
    id: 'gemini',
    async generateText() {
      throw new Error('Not implemented for test');
    },
    async generateStructured<T>(): Promise<AIStructuredResponse<T>> {
      // Mock Gemini's structured response for production planning
      const responseData = {
        production_notes: [
          'Vertical 9:16 safe-zone framing for Instagram Reels.',
          'High visual contrast with crisp code visuals.',
        ],
        background_music: {
          description: 'Low-profile rhythmic synthwave with steady 110 BPM groove',
          tempo: '110 BPM',
          mood: 'Focused, modern, tech-forward',
        },
        scenes: [
          {
            scene_order: 1,
            purpose: 'Grab developer attention with counter-intuitive truth',
            visual_type: 'talking_head',
            visual_prompt: 'Front-facing mid-shot of senior engineer in modern tech office, warm ambient lighting, 9:16 vertical',
            b_roll_requirement: 'Subtle code terminal in background out of focus',
            camera_direction: 'Medium close-up at eye level',
            composition: 'Subject center-framed, lower third reserved for subtitles',
            overlays: [
              {
                text: 'The AI Engineering Paradox',
                style: 'headline',
                start_second: 1.0,
                end_second: 6.0,
              },
            ],
            sound_effects: [],
          },
          {
            scene_order: 2,
            purpose: 'Present verifiable evidence of code churn',
            visual_type: 'code_visual',
            visual_prompt: 'High resolution code editor diff showing massive redline deletion spikes, 9:16 vertical',
            b_roll_requirement: 'Scrolling git commit graph with churn telemetry',
            camera_direction: 'Slight slow push-in on code diff card',
            composition: 'Top two-thirds code card, bottom third subtitles',
            overlays: [
              {
                text: '+100% Code Churn (GitClear 2024)',
                style: 'stat_callout',
                start_second: 10.0,
                end_second: 18.0,
              },
            ],
            sound_effects: [
              {
                description: 'Tech data whoosh',
                at_second: 9.5,
              },
            ],
          },
          {
            scene_order: 3,
            purpose: 'Provide actionable mindset shift towards architecture',
            visual_type: 'diagram',
            visual_prompt: 'Clean minimalist cloud architecture diagram with glowing data streams, 9:16 vertical',
            b_roll_requirement: 'Motion diagram connecting microservices and verification layer',
            camera_direction: 'Static diagram layout with subtle panning',
            composition: 'Centered schematic',
            overlays: [],
            sound_effects: [],
          },
          {
            scene_order: 4,
            purpose: 'Drive comment engagement and follow',
            visual_type: 'talking_head',
            visual_prompt: 'Smiling engineer gesturing towards screen with engaging delivery, 9:16 vertical',
            b_roll_requirement: 'Instagram comment notification pop-up',
            camera_direction: 'Close-up direct to camera',
            composition: 'Subject centered',
            overlays: [
              {
                text: 'Comment Your View Below',
                style: 'badge',
                start_second: 52.0,
                end_second: 58.0,
              },
            ],
            sound_effects: [],
          },
        ],
        transitions: [
          { from_scene_order: 1, to_scene_order: 2, transition_type: 'zoom_in', duration_seconds: 0.3 },
          { from_scene_order: 2, to_scene_order: 3, transition_type: 'slide_left', duration_seconds: 0.3 },
          { from_scene_order: 3, to_scene_order: 4, transition_type: 'crossfade', duration_seconds: 0.4 },
        ],
        unresolved_requirements: [],
        confidence: 'high',
      };

      return {
        data: responseData as unknown as T,
        raw: JSON.stringify(responseData),
      };
    },
  };

  const agent = new ProductionAgent(mockAIProvider);
  const result = await agent.execute({
    brief: mockBrief,
    researchPackage: mockResearch,
    script: mockScript,
    projectId: 'test-project-123',
    jobId: 'test-job-456',
    platform: 'instagram',
  });

  const pkg = result.package;

  assert(pkg !== undefined, 'ProductionAgent generated a valid ProductionPackage');
  assert(pkg.scenes.length === 4, `All 4 script sections translated into scenes (got ${pkg.scenes.length})`);
  assert(pkg.platform === 'instagram', 'Target platform is instagram');
  assert(pkg.aspect_ratio === '9:16', 'Aspect ratio configured as 9:16');

  // VERBATIM SPOKEN SCRIPT VERIFICATION
  const spokenTextsMatch = pkg.scenes.every(
    (scene, idx) => scene.spoken_text === mockScript.sections[idx].spoken_text
  );
  assert(spokenTextsMatch, 'CRITICAL: Spoken text strictly preserved verbatim across all scenes');

  // ASSETS REQUIRING GENERATION MUST BE PENDING
  const allVisuals = [...pkg.visual_assets, ...pkg.scenes.flatMap((s) => s.visual_assets)];
  const allPending = allVisuals.every((v) => v.status === 'pending' && v.generation_required === true);
  assert(allPending, 'CRITICAL: All visual assets correctly marked generation_required=true and status=pending');

  const allAudioPending = pkg.audio_assets.every((a) => a.status === 'pending' && a.generation_required === true);
  assert(allAudioPending, 'CRITICAL: All audio assets correctly marked generation_required=true and status=pending');

  // CAPTIONS VERIFICATION
  const totalCaptions = pkg.captions.length;
  assert(totalCaptions > 8, `Deterministic caption cards generated across scenes (total: ${totalCaptions})`);

  // ASSET CHECKLIST VERIFICATION
  assert(pkg.asset_checklist.length > 5, `Asset checklist compiled with items (${pkg.asset_checklist.length})`);
  const allChecklistPending = pkg.asset_checklist.every((c) => c.status === 'pending');
  assert(allChecklistPending, 'All checklist items in planning blueprint are pending');

  console.log('\n======================================================');
  console.log(`  Tests Complete: ${passed} passed, ${failed} failed`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
