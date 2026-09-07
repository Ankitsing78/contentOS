/**
 * ContentOS - Content Understanding Zod Schema
 * Enforces strict validation on AI model outputs before persistence.
 */

import { z } from 'zod';

export const ContentBriefSchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(150, 'Title must be under 150 characters'),
  summary: z
    .string()
    .min(10, 'Summary must be at least 10 characters')
    .max(1000, 'Summary must be under 1000 characters'),
  topic: z
    .string()
    .min(2, 'Topic must be at least 2 characters')
    .max(100, 'Topic must be under 100 characters'),
  audience: z
    .string()
    .min(3, 'Audience must be specified')
    .max(200, 'Audience must be under 200 characters'),
  content_goal: z
    .string()
    .min(5, 'Content goal must be specified')
    .max(250, 'Content goal must be under 250 characters'),
  angle: z
    .string()
    .min(5, 'Angle must be specified')
    .max(300, 'Angle must be under 300 characters'),
  hook: z
    .string()
    .min(5, 'Hook must be specified')
    .max(250, 'Hook must be under 250 characters'),
  tone: z
    .string()
    .min(3, 'Tone must be specified')
    .max(100, 'Tone must be under 100 characters'),
  key_points: z
    .array(z.string().min(3))
    .min(1, 'At least one key point is required')
    .max(10, 'Maximum 10 key points'),
  suggested_formats: z
    .array(z.string().min(2))
    .min(1, 'At least one suggested format is required'),
  platforms: z
    .array(z.enum(['youtube', 'instagram', 'x']))
    .min(1, 'At least one target platform must be specified'),
  needs_research: z
    .boolean()
    .describe('Whether external factual or statistical research is needed before drafting'),
});

export type ValidatedContentBrief = z.infer<typeof ContentBriefSchema>;
