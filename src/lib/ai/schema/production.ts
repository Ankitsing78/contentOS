/**
 * ContentOS - Production & Media Planning Zod Validation Schemas
 * 
 * Enforces strict structural integrity, timing contiguity, valid source references,
 * and explicit pending asset states for all media planning deliverables.
 */

import { z } from 'zod';
import { SourceReferenceSchema } from './script';

export const AssetStatusEnum = z.enum([
  'pending',
  'in_progress',
  'completed',
  'failed',
  'not_required',
]);

export const AspectRatioEnum = z.enum(['9:16', '16:9', '1:1', '4:5']);

export const VisualTypeEnum = z.enum([
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
]);

export const VisualAssetTypeEnum = z.enum([
  'background_image',
  'overlay_image',
  'video_clip',
  'b_roll_clip',
  'chart_graphic',
  'code_snippet_card',
  'diagram',
]);

export const AudioAssetTypeEnum = z.enum([
  'voiceover',
  'background_music',
  'sound_effect',
  'ambient',
]);

export const VisualAssetRequirementSchema = z.object({
  id: z.string().min(1, 'Asset requirement ID is required'),
  scene_id: z.string().min(1, 'Scene ID is required'),
  asset_type: VisualAssetTypeEnum,
  description: z.string().min(1, 'Asset description is required'),
  prompt: z.string().min(1, 'Asset generation prompt is required'),
  aspect_ratio: AspectRatioEnum,
  resolution: z.string().min(1, 'Resolution string is required'),
  duration_seconds: z.number().min(0, 'Duration must be non-negative'),
  source: z.enum(['ai_generated', 'template_rendered', 'screen_capture', 'stock']).default('ai_generated'),
  generation_required: z.boolean().default(true),
  status: AssetStatusEnum.default('pending'),
  storage_path: z.string().optional(),
  notes: z.string().optional(),
});

export const AudioAssetRequirementSchema = z.object({
  id: z.string().min(1, 'Audio requirement ID is required'),
  scene_id: z.string().optional(),
  audio_type: AudioAssetTypeEnum,
  description: z.string().min(1, 'Audio description is required'),
  text: z.string().optional(),
  voice_requirement: z.string().optional(),
  duration_seconds: z.number().min(0, 'Duration must be non-negative'),
  generation_required: z.boolean().default(true),
  status: AssetStatusEnum.default('pending'),
  storage_path: z.string().optional(),
  notes: z.string().optional(),
});

export const CaptionBlockSchema = z
  .object({
    id: z.string().min(1, 'Caption ID is required'),
    scene_id: z.string().min(1, 'Scene ID is required'),
    start_second: z.number().min(0, 'Caption start_second must be non-negative'),
    end_second: z.number().min(0, 'Caption end_second must be non-negative'),
    text: z.string().min(1, 'Caption text cannot be empty'),
    emphasis_words: z.array(z.string()).default([]),
  })
  .refine((c) => c.end_second >= c.start_second, {
    message: 'Caption end_second must be >= start_second',
    path: ['end_second'],
  });

export const AssetChecklistItemSchema = z.object({
  id: z.string().min(1, 'Checklist ID is required'),
  asset_id: z.string().min(1, 'Asset ID is required'),
  category: z.enum(['visual', 'audio', 'overlay', 'caption']),
  requirement: z.string().min(1, 'Requirement description is required'),
  status: AssetStatusEnum.default('pending'),
  generation_required: z.boolean().default(true),
  notes: z.string().optional(),
});

export const ProductionSceneSchema = z
  .object({
    id: z.string().min(1, 'Scene ID is required'),
    order: z.number().int().min(1, 'Scene order must be >= 1'),
    start_second: z.number().min(0, 'start_second must be non-negative'),
    end_second: z.number().min(0, 'end_second must be non-negative'),
    duration_seconds: z.number().min(0.5, 'Scene duration must be at least 0.5s'),
    purpose: z.string().min(1, 'Scene purpose is required'),
    spoken_text: z.string().default(''),
    visual_type: VisualTypeEnum,
    visual_prompt: z.string().default(''),
    b_roll_requirement: z.string().default(''),
    camera_direction: z.string().default('Medium close-up at eye level'),
    composition: z.string().default('Subject centered, lower-third clear for subtitles'),
    on_screen_text: z.string().optional(),
    caption_text: z.string().default(''),
    source_references: z.array(SourceReferenceSchema).default([]),
    visual_assets: z.array(VisualAssetRequirementSchema).default([]),
    audio_assets: z.array(AudioAssetRequirementSchema).default([]),
    captions: z.array(CaptionBlockSchema).default([]),
  })
  .refine((s) => s.end_second >= s.start_second, {
    message: 'Scene end_second must be >= start_second',
    path: ['end_second'],
  });

export const ProductionPackageSchema = z
  .object({
    id: z.string().optional(),
    project_id: z.string().min(1, 'project_id is required'),
    job_id: z.string().optional(),
    script_id: z.string().optional(),
    platform: z.enum(['youtube', 'instagram', 'x']),
    format: z.enum(['short_video', 'long_video', 'thread', 'reel', 'post']).default('short_video'),
    duration_seconds: z.number().positive('duration_seconds must be positive'),
    aspect_ratio: AspectRatioEnum.default('9:16'),
    scenes: z.array(ProductionSceneSchema).min(1, 'Production package must have at least one scene'),
    narration_segments: z.array(AudioAssetRequirementSchema).default([]),
    visual_assets: z.array(VisualAssetRequirementSchema).default([]),
    audio_assets: z.array(AudioAssetRequirementSchema).default([]),
    overlays: z
      .array(
        z.object({
          id: z.string(),
          scene_id: z.string(),
          text: z.string(),
          style: z.enum(['headline', 'stat_callout', 'quote', 'badge']),
          start_second: z.number().min(0),
          end_second: z.number().min(0),
        })
      )
      .default([]),
    captions: z.array(CaptionBlockSchema).default([]),
    transitions: z
      .array(
        z.object({
          from_scene_order: z.number().int(),
          to_scene_order: z.number().int(),
          transition_type: z.enum(['cut', 'crossfade', 'zoom_in', 'slide_left', 'whip_pan']),
          duration_seconds: z.number().min(0).default(0.3),
        })
      )
      .default([]),
    asset_checklist: z.array(AssetChecklistItemSchema).default([]),
    production_notes: z.array(z.string()).default([]),
    unresolved_requirements: z.array(z.string()).default([]),
    confidence: z.enum(['low', 'medium', 'high']).default('high'),
    generated_at: z.string().default(() => new Date().toISOString()),
    version: z.number().int().default(1),
    is_mock_data: z.boolean().default(false),
  })
  .refine(
    (pkg) => {
      // Validate contiguous scene timing
      for (let i = 0; i < pkg.scenes.length; i++) {
        if (i === 0 && pkg.scenes[0].start_second !== 0) return false;
        if (i > 0) {
          const prev = pkg.scenes[i - 1];
          const curr = pkg.scenes[i];
          if (Math.abs(prev.end_second - curr.start_second) > 0.1) return false;
        }
      }
      return true;
    },
    {
      message: 'Scenes must be sequential and contiguous with zero gaps or overlaps',
      path: ['scenes'],
    }
  )
  .refine(
    (pkg) => {
      // Planning phase rule: assets requiring generation cannot be falsely marked 'completed'
      const allVisuals = [
        ...pkg.visual_assets,
        ...pkg.scenes.flatMap((s) => s.visual_assets),
      ];
      return !allVisuals.some((v) => v.generation_required && v.status === 'completed');
    },
    {
      message: 'Planning Agent cannot mark assets that require generation as completed',
      path: ['visual_assets'],
    }
  );

export type ValidatedProductionPackage = z.infer<typeof ProductionPackageSchema>;
export type ValidatedProductionScene = z.infer<typeof ProductionSceneSchema>;
export type ValidatedVisualAssetRequirement = z.infer<typeof VisualAssetRequirementSchema>;
export type ValidatedAudioAssetRequirement = z.infer<typeof AudioAssetRequirementSchema>;
export type ValidatedCaptionBlock = z.infer<typeof CaptionBlockSchema>;
export type ValidatedAssetChecklistItem = z.infer<typeof AssetChecklistItemSchema>;
