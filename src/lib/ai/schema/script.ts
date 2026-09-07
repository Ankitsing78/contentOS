/**
 * ContentOS - Script Domain Zod Validation Schemas
 */

import { z } from 'zod';

export const ScriptSectionTypeEnum = z.enum([
  'hook',
  'intro',
  'problem',
  'evidence',
  'counter_argument',
  'resolution',
  'cta',
]);

export const SourceReferenceSchema = z.object({
  source_id: z.string().optional(),
  claim: z.string().min(1, 'Claim cannot be empty'),
  source_title: z.string().min(1, 'Source title cannot be empty'),
  source_url: z.string().default(''),
  usage_note: z.string().optional(),
});

export const ScriptSectionSchema = z
  .object({
    id: z.string().optional(),
    order: z.number().int().min(1, 'Section order must be >= 1'),
    type: ScriptSectionTypeEnum,
    start_second: z.number().min(0, 'start_second must be non-negative'),
    end_second: z.number().min(0, 'end_second must be non-negative'),
    spoken_text: z.string().min(1, 'spoken_text cannot be empty'),
    visual_direction: z.string().default('Talking head presenting clearly to camera'),
    b_roll_suggestions: z.array(z.string()).default([]),
    on_screen_text: z.string().optional(),
    source_references: z.array(SourceReferenceSchema).default([]),
  })
  .refine((sec) => sec.end_second >= sec.start_second, {
    message: 'end_second must be greater than or equal to start_second',
    path: ['end_second'],
  });

export const ScriptSchema = z.object({
  id: z.string().optional(),
  project_id: z.string().default(''),
  job_id: z.string().optional(),
  title: z.string().min(1, 'Title cannot be empty'),
  format: z.enum(['short_video', 'long_video', 'thread', 'reel', 'post']).default('short_video'),
  platform: z.enum(['youtube', 'instagram', 'x', 'master']).default('master'),
  target_duration_seconds: z.number().int().positive('target_duration_seconds must be positive'),
  estimated_duration_seconds: z.number().int().positive('estimated_duration_seconds must be positive'),
  word_count: z.number().int().nonnegative('word_count must be non-negative'),
  language: z.string().default('en'),
  tone: z.string().default('Engaging and authoritative'),
  hook: z.string().min(1, 'Hook is required'),
  sections: z.array(ScriptSectionSchema).min(1, 'Script must contain at least one section'),
  cta: z.string().min(1, 'CTA is required'),
  source_references: z.array(SourceReferenceSchema).default([]),
  unresolved_claims: z.array(z.string()).default([]),
  generated_at: z.string().default(() => new Date().toISOString()),
  version: z.number().int().default(1),
  is_mock_data: z.boolean().default(false),
});

export const PlatformScriptVariantSchema = z.object({
  platform: z.enum(['youtube', 'instagram', 'x']),
  title: z.string().min(1, 'Variant title is required'),
  format: z.enum(['short_video', 'long_video', 'thread', 'reel', 'post']).default('short_video'),
  target_duration_seconds: z.number().int().positive(),
  estimated_duration_seconds: z.number().int().positive(),
  word_count: z.number().int().nonnegative(),
  hook: z.string().min(1, 'Variant hook is required'),
  cta: z.string().min(1, 'Variant CTA is required'),
  sections: z.array(ScriptSectionSchema).min(1),
  source_references: z.array(SourceReferenceSchema).default([]),
  platform_adjustments: z.string().default('Tailored for platform pacing and tone'),
});

export const ScriptPackageSchema = z.object({
  master_script: ScriptSchema,
  platform_variants: z.array(PlatformScriptVariantSchema).default([]),
  consistency_notes: z.string().default(''),
  unsupported_claims: z.array(z.string()).default([]),
  overall_confidence: z.enum(['low', 'medium', 'high']).default('medium'),
  generated_at: z.string().default(() => new Date().toISOString()),
  is_mock_data: z.boolean().default(false),
});

export const ScriptPlanSchema = z.object({
  narrative_goal: z.string().min(1),
  audience: z.string().min(1),
  opening_strategy: z.string().min(1),
  key_sections: z.array(
    z.object({
      title: z.string().min(1),
      section_type: ScriptSectionTypeEnum,
      estimated_duration_seconds: z.number().positive(),
      evidence_points: z.array(z.string()).default([]),
      visual_idea: z.string().default(''),
    })
  ).min(1),
  cta_strategy: z.string().min(1),
  platform_adjustments: z.record(z.string(), z.string()).default({}),
});

export type ValidatedScriptSourceReference = z.infer<typeof SourceReferenceSchema>;
export type ValidatedScriptSection = z.infer<typeof ScriptSectionSchema>;
export type ValidatedScript = z.infer<typeof ScriptSchema>;
export type ValidatedPlatformScriptVariant = z.infer<typeof PlatformScriptVariantSchema>;
export type ValidatedScriptPackage = z.infer<typeof ScriptPackageSchema>;
export type ValidatedScriptPlan = z.infer<typeof ScriptPlanSchema>;
