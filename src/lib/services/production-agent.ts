/**
 * ContentOS - Production & Media Planning Agent Service
 * 
 * Translates an authoritative script, research package, and creative brief
 * into a complete, structured ProductionPackage.
 * 
 * Strictly preserves spoken text verbatim, breaks scenes into timed captions,
 * designs visual and audio specifications, and marks all generation requirements
 * as "pending" (no premature asset completion).
 */

import { IAIProvider, getAIProvider } from '@/lib/ai/provider';
import {
  PRODUCTION_AGENT_SYSTEM_PROMPT,
  buildProductionPlanPrompt,
} from '@/lib/ai/prompts/production-agent';
import {
  ProductionPackageSchema,
  ValidatedProductionPackage,
  ValidatedProductionScene,
  ValidatedVisualAssetRequirement,
  ValidatedAudioAssetRequirement,
  ValidatedCaptionBlock,
  ValidatedAssetChecklistItem,
} from '@/lib/ai/schema/production';
import {
  getPlatformProductionConfig,
  PlatformProductionConfig,
} from '@/lib/production/config';
import { generateCaptionBlocks } from '@/lib/production/caption-timing';
import {
  ContentBrief,
  ResearchPackage,
  PlatformType,
  AIMessage,
  ScriptFormat,
} from '@/types';
import { Script, PlatformScriptVariant, ScriptPackage } from '@/types/script';
import { VisualType, VisualAssetType } from '@/types/production';

export interface ProductionAgentInput {
  brief: ContentBrief;
  researchPackage: ResearchPackage;
  script: Script | PlatformScriptVariant;
  scriptPackage?: ScriptPackage;
  platform?: PlatformType;
  format?: ScriptFormat;
  projectId: string;
  jobId?: string;
  scriptId?: string;
  aiProvider?: IAIProvider;
}

export interface ProductionAgentResult {
  package: ValidatedProductionPackage;
  rawJson?: string;
  config: PlatformProductionConfig;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

interface RawProductionResponse {
  production_notes?: string[];
  background_music?: {
    description: string;
    tempo?: string;
    mood?: string;
  };
  scenes?: Array<{
    scene_order: number;
    purpose?: string;
    visual_type?: string;
    visual_prompt?: string;
    b_roll_requirement?: string;
    camera_direction?: string;
    composition?: string;
    overlays?: Array<{
      text: string;
      style?: 'headline' | 'stat_callout' | 'quote' | 'badge';
      start_second?: number;
      end_second?: number;
    }>;
    sound_effects?: Array<{
      description: string;
      at_second?: number;
    }>;
  }>;
  transitions?: Array<{
    from_scene_order: number;
    to_scene_order: number;
    transition_type: 'cut' | 'crossfade' | 'zoom_in' | 'slide_left' | 'whip_pan';
    duration_seconds?: number;
  }>;
  unresolved_requirements?: string[];
  confidence?: 'low' | 'medium' | 'high';
}

function mapVisualTypeToAssetType(visualType: VisualType): VisualAssetType {
  switch (visualType) {
    case 'talking_head':
    case 'generated_video':
      return 'video_clip';
    case 'b_roll':
      return 'b_roll_clip';
    case 'chart':
      return 'chart_graphic';
    case 'code_visual':
      return 'code_snippet_card';
    case 'diagram':
      return 'diagram';
    case 'screen_recording':
      return 'video_clip';
    case 'kinetic_text':
    case 'simple_background':
    case 'generated_image':
    case 'stock_style':
    default:
      return 'background_image';
  }
}

export class ProductionAgent {
  private aiProvider: IAIProvider;

  constructor(customAIProvider?: IAIProvider) {
    this.aiProvider = customAIProvider || getAIProvider('gemini');
  }

  /**
   * Executes the Production & Media Planning Agent
   */
  async execute(input: ProductionAgentInput): Promise<ProductionAgentResult> {
    const { brief, researchPackage, script, projectId, jobId, scriptId } = input;
    const ai = input.aiProvider || this.aiProvider;

    // 1. Resolve Target Platform & Format
    const rawPlatform = script.platform === 'master'
      ? (input.platform || 'instagram')
      : (script.platform as PlatformType);
    const platform: PlatformType = ['youtube', 'instagram', 'x'].includes(rawPlatform)
      ? rawPlatform
      : 'instagram';

    const format: ScriptFormat = input.format || script.format || 'short_video';
    const config = getPlatformProductionConfig(platform, format);

    console.log(
      `[ContentOS] [ProductionAgent] Initiating production planning for ${platform.toUpperCase()} (${config.aspectRatio}, ${config.resolution})`
    );

    // 2. Build Planning Prompt
    const prompt = buildProductionPlanPrompt(script, researchPackage, brief, config);
    const messages: AIMessage[] = [
      { role: 'system', content: PRODUCTION_AGENT_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ];

    const schemaDescription = `Return a JSON object conforming strictly to:
{
  "production_notes": string[],
  "background_music": {
    "description": string,
    "tempo": string,
    "mood": string
  },
  "scenes": [
    {
      "scene_order": number,
      "purpose": string,
      "visual_type": "talking_head" | "screen_recording" | "code_visual" | "chart" | "diagram" | "kinetic_text" | "b_roll" | "stock_style" | "generated_image" | "generated_video" | "simple_background",
      "visual_prompt": string,
      "b_roll_requirement": string,
      "camera_direction": string,
      "composition": string,
      "overlays": [
        {
          "text": string,
          "style": "headline" | "stat_callout" | "quote" | "badge",
          "start_second": number,
          "end_second": number
        }
      ],
      "sound_effects": [
        {
          "description": string,
          "at_second": number
        }
      ]
    }
  ],
  "transitions": [
    {
      "from_scene_order": number,
      "to_scene_order": number,
      "transition_type": "cut" | "crossfade" | "zoom_in" | "slide_left" | "whip_pan",
      "duration_seconds": number
    }
  ],
  "unresolved_requirements": string[],
  "confidence": "low" | "medium" | "high"
}`;

    // 3. Call AI Provider for Structured Production Specifications
    const aiResponse = await ai.generateStructured<RawProductionResponse>(
      messages,
      schemaDescription,
      { maxTokens: 8192 }
    );
    const rawData = aiResponse.data;

    // 4. Assemble Verified Production Scenes
    const scriptSections = script.sections || [];
    const scenes: ValidatedProductionScene[] = [];
    const allVisualAssets: ValidatedVisualAssetRequirement[] = [];
    const allAudioAssets: ValidatedAudioAssetRequirement[] = [];
    const allCaptions: ValidatedCaptionBlock[] = [];
    const allOverlays: Array<{
      id: string;
      scene_id: string;
      text: string;
      style: 'headline' | 'stat_callout' | 'quote' | 'badge';
      start_second: number;
      end_second: number;
    }> = [];

    const totalDurationSeconds = script.target_duration_seconds || 60;

    scriptSections.forEach((section, idx) => {
      const order = section.order || idx + 1;
      const sceneId = `scene-${order}`;
      const startSec = section.start_second;
      const endSec = section.end_second;
      const durationSec = Math.max(0.5, Math.round((endSec - startSec) * 100) / 100);

      // Find matching scene from AI output
      const aiScene = (rawData.scenes || []).find((s) => s.scene_order === order) || rawData.scenes?.[idx];

      const validVisualType: VisualType = [
        'talking_head',
        'screen_recording',
        'code_visual',
        'chart',
        'diagram',
        'kinetic_text',
        'b_roll',
        'stock_style',
        'generated_image',
        'generated_video',
        'simple_background',
      ].includes(aiScene?.visual_type || '')
        ? (aiScene!.visual_type as VisualType)
        : section.type === 'hook'
        ? 'talking_head'
        : 'b_roll';

      const visualPrompt =
        aiScene?.visual_prompt ||
        `High quality cinematic visual for ${section.type}: ${section.visual_direction || section.spoken_text}. ${config.aspectRatio} aspect ratio, professional lighting.`;

      const bRollRequirement =
        aiScene?.b_roll_requirement ||
        (section.b_roll_suggestions && section.b_roll_suggestions.length > 0
          ? section.b_roll_suggestions.join('; ')
          : section.visual_direction || 'Supporting visual b-roll matching dialogue.');

      // Deterministic Caption Blocks
      const sceneCaptions: ValidatedCaptionBlock[] = generateCaptionBlocks({
        sceneId,
        spokenText: section.spoken_text,
        startSecond: startSec,
        endSecond: endSec,
        maxWordsPerBlock: 5,
      });
      allCaptions.push(...sceneCaptions);

      // Visual Asset Requirements for this scene
      const assetType = mapVisualTypeToAssetType(validVisualType);
      const sceneVisualAsset: ValidatedVisualAssetRequirement = {
        id: `vis-${sceneId}-1`,
        scene_id: sceneId,
        asset_type: assetType,
        description: `Visual asset for Scene ${order} (${validVisualType})`,
        prompt: visualPrompt,
        aspect_ratio: config.aspectRatio,
        resolution: config.resolution,
        duration_seconds: durationSec,
        source: 'ai_generated',
        generation_required: true,
        status: 'pending',
        notes: `Framing: ${config.aspectRatio} safe-zone centered.`,
      };

      const sceneVisualAssets: ValidatedVisualAssetRequirement[] = [sceneVisualAsset];
      allVisualAssets.push(sceneVisualAsset);

      // Audio Asset Requirements: Narration Voiceover
      const sceneNarrationAsset: ValidatedAudioAssetRequirement = {
        id: `aud-nar-${sceneId}`,
        scene_id: sceneId,
        audio_type: 'voiceover',
        description: `Voiceover narration for Scene ${order}`,
        text: section.spoken_text,
        voice_requirement: brief.tone || 'Engaging, articulate developer-focused delivery',
        duration_seconds: durationSec,
        generation_required: true,
        status: 'pending',
        notes: `Delivery speed ~150 WPM.`,
      };

      const sceneAudioAssets: ValidatedAudioAssetRequirement[] = [sceneNarrationAsset];
      allAudioAssets.push(sceneNarrationAsset);

      // Sound effect if requested
      if (aiScene?.sound_effects && aiScene.sound_effects.length > 0) {
        aiScene.sound_effects.forEach((sfx, sfxIdx) => {
          const sfxAsset: ValidatedAudioAssetRequirement = {
            id: `aud-sfx-${sceneId}-${sfxIdx + 1}`,
            scene_id: sceneId,
            audio_type: 'sound_effect',
            description: sfx.description || 'Subtle interface sound effect',
            duration_seconds: 1.0,
            generation_required: true,
            status: 'pending',
            notes: `Triggers at ${sfx.at_second ?? startSec}s`,
          };
          sceneAudioAssets.push(sfxAsset);
          allAudioAssets.push(sfxAsset);
        });
      }

      // Overlays
      if (aiScene?.overlays && aiScene.overlays.length > 0) {
        aiScene.overlays.forEach((ov, ovIdx) => {
          allOverlays.push({
            id: `overlay-${sceneId}-${ovIdx + 1}`,
            scene_id: sceneId,
            text: ov.text,
            style: ['headline', 'stat_callout', 'quote', 'badge'].includes(ov.style || '')
              ? (ov.style as 'headline' | 'stat_callout' | 'quote' | 'badge')
              : 'headline',
            start_second: Math.max(startSec, ov.start_second ?? startSec),
            end_second: Math.min(endSec, ov.end_second ?? endSec),
          });
        });
      } else if (section.on_screen_text) {
        allOverlays.push({
          id: `overlay-${sceneId}-1`,
          scene_id: sceneId,
          text: section.on_screen_text,
          style: 'headline',
          start_second: startSec,
          end_second: Math.min(endSec, startSec + 3),
        });
      }

      // Finalized Scene Object
      scenes.push({
        id: sceneId,
        order,
        start_second: startSec,
        end_second: endSec,
        duration_seconds: durationSec,
        purpose: aiScene?.purpose || `Deliver ${section.type} narrative impact`,
        spoken_text: section.spoken_text, // STRICTLY VERBATIM
        visual_type: validVisualType,
        visual_prompt: visualPrompt,
        b_roll_requirement: bRollRequirement,
        camera_direction: aiScene?.camera_direction || 'Medium close-up at eye level',
        composition: aiScene?.composition || 'Subject centered with upper two-thirds headroom, lower third caption area',
        on_screen_text: section.on_screen_text || undefined,
        caption_text: section.spoken_text,
        source_references: section.source_references || [],
        visual_assets: sceneVisualAssets,
        audio_assets: sceneAudioAssets,
        captions: sceneCaptions,
      });
    });

    // 5. Global Background Music Asset
    const bgmAsset: ValidatedAudioAssetRequirement = {
      id: 'aud-bgm-score',
      audio_type: 'background_music',
      description:
        rawData.background_music?.description ||
        `Subtle modern background score matching ${brief.tone || 'focused authoritative'} tone`,
      duration_seconds: totalDurationSeconds,
      generation_required: true,
      status: 'pending',
      notes: `Mood: ${rawData.background_music?.mood || 'Technological, ambient'}, Tempo: ${rawData.background_music?.tempo || '115 BPM'}`,
    };
    allAudioAssets.push(bgmAsset);

    // 6. Assemble Transitions
    const transitions = (rawData.transitions || []).map((t) => ({
      from_scene_order: t.from_scene_order,
      to_scene_order: t.to_scene_order,
      transition_type: ['cut', 'crossfade', 'zoom_in', 'slide_left', 'whip_pan'].includes(t.transition_type)
        ? t.transition_type
        : ('cut' as const),
      duration_seconds: t.duration_seconds || 0.3,
    }));

    // If AI didn't provide transitions, generate sensible cut transitions between scenes
    if (transitions.length === 0 && scenes.length > 1) {
      for (let i = 0; i < scenes.length - 1; i++) {
        transitions.push({
          from_scene_order: scenes[i].order,
          to_scene_order: scenes[i + 1].order,
          transition_type: 'cut',
          duration_seconds: 0.1,
        });
      }
    }

    // 7. Compile Complete Asset Checklist
    const assetChecklist: ValidatedAssetChecklistItem[] = [];

    // Visuals
    allVisualAssets.forEach((vis) => {
      assetChecklist.push({
        id: `chk-${vis.id}`,
        asset_id: vis.id,
        category: 'visual',
        requirement: `${vis.asset_type.toUpperCase()}: ${vis.description}`,
        status: 'pending',
        generation_required: true,
        notes: vis.prompt,
      });
    });

    // Narration segments
    allAudioAssets
      .filter((a) => a.audio_type === 'voiceover')
      .forEach((nar) => {
        assetChecklist.push({
          id: `chk-${nar.id}`,
          asset_id: nar.id,
          category: 'audio',
          requirement: nar.description,
          status: 'pending',
          generation_required: true,
          notes: nar.text,
        });
      });

    // BGM
    assetChecklist.push({
      id: `chk-${bgmAsset.id}`,
      asset_id: bgmAsset.id,
      category: 'audio',
      requirement: `BGM: ${bgmAsset.description}`,
      status: 'pending',
      generation_required: true,
      notes: bgmAsset.notes,
    });

    // Overlays
    allOverlays.forEach((ov) => {
      assetChecklist.push({
        id: `chk-${ov.id}`,
        asset_id: ov.id,
        category: 'overlay',
        requirement: `OVERLAY (${ov.style}): "${ov.text}"`,
        status: 'pending',
        generation_required: true,
        notes: `Visible from ${ov.start_second}s to ${ov.end_second}s`,
      });
    });

    // Captions summary
    assetChecklist.push({
      id: 'chk-captions-all',
      asset_id: 'captions-synchronized',
      category: 'caption',
      requirement: `Synchronized burned-in captions (${allCaptions.length} timed blocks)`,
      status: 'pending',
      generation_required: true,
      notes: 'Deterministic timestamps aligned with audio narration',
    });

    // 8. Construct & Validate Final ProductionPackage
    const rawPackage = {
      project_id: projectId,
      job_id: jobId,
      script_id: scriptId,
      platform,
      format,
      duration_seconds: totalDurationSeconds,
      aspect_ratio: config.aspectRatio,
      scenes,
      narration_segments: allAudioAssets.filter((a) => a.audio_type === 'voiceover'),
      visual_assets: allVisualAssets,
      audio_assets: allAudioAssets,
      overlays: allOverlays,
      captions: allCaptions,
      transitions,
      asset_checklist: assetChecklist,
      production_notes: rawData.production_notes || [
        `Target aspect ratio ${config.aspectRatio} (${config.resolution}).`,
        'All spoken dialogue verified against approved script.',
        'Assets specified with generation_required: true and pending status.',
      ],
      unresolved_requirements: rawData.unresolved_requirements || [],
      confidence: rawData.confidence || 'high',
      generated_at: new Date().toISOString(),
      version: 1,
      is_mock_data: researchPackage.isMockData === true,
    };

    const parsedPackage = ProductionPackageSchema.safeParse(rawPackage);
    if (!parsedPackage.success) {
      const issue = parsedPackage.error.issues[0]?.message || 'ProductionPackage validation failed';
      console.error('[ContentOS] ProductionPackage validation error:', parsedPackage.error.issues);
      throw new Error(`Invalid assembled ProductionPackage: ${issue}`);
    }

    console.log(
      `[ContentOS] [ProductionAgent] Blueprint generated successfully. ${scenes.length} scenes, ${allVisualAssets.length} visual requirements, ${allCaptions.length} caption blocks.`
    );

    return {
      package: parsedPackage.data,
      rawJson: aiResponse.raw,
      config,
      usage: aiResponse.usage,
    };
  }
}
