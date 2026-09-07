/**
 * ContentOS - Strict Zod Validation Schemas for Research Outputs
 */

import { z } from 'zod';

export const ResearchPrioritySchema = z.enum(['low', 'medium', 'high']);
export const ResearchConfidenceSchema = z.enum(['low', 'medium', 'high']);
export const SourceRelevanceSchema = z.enum(['low', 'medium', 'high']);
export const SourceCredibilitySchema = z.enum(['low', 'medium', 'high']);

export const ResearchSourceTypeSchema = z.enum([
  'article',
  'paper',
  'news',
  'documentation',
  'report',
  'mock_test_fixture',
]);

/**
 * Zod Schema for Phase A: Gemini-generated Research Plan
 */
export const ResearchPlanSchema = z.object({
  research_questions: z
    .array(z.string().min(5, 'Research question must be at least 5 characters'))
    .min(1, 'At least one research question is required')
    .max(10, 'Maximum 10 research questions allowed'),
  claims_to_verify: z
    .array(z.string().min(3, 'Claim must be at least 3 characters'))
    .default([]),
  facts_needed: z
    .array(z.string().min(3, 'Fact description must be at least 3 characters'))
    .default([]),
  source_requirements: z
    .array(z.string().min(3, 'Source requirement must be at least 3 characters'))
    .default([]),
  freshness_requirements: z
    .string()
    .min(3, 'Freshness requirement must be specified (e.g., "within last 12 months")'),
  research_priority: ResearchPrioritySchema,
});

export type ValidatedResearchPlan = z.infer<typeof ResearchPlanSchema>;

/**
 * Zod Schema for Individual Research Source
 */
export const ResearchSourceSchema = z.object({
  title: z.string().min(1, 'Source title is required'),
  url: z.string().default(''),
  publisher: z.string().min(1, 'Publisher is required'),
  published_at: z.string().optional(),
  retrieved_at: z.string().min(1, 'Retrieved timestamp is required'),
  source_type: ResearchSourceTypeSchema,
  relevance: SourceRelevanceSchema,
  credibility: SourceCredibilitySchema,
  evidence_summary: z.string().min(1, 'Evidence summary is required'),
});

export type ValidatedResearchSource = z.infer<typeof ResearchSourceSchema>;

/**
 * Zod Schema for Specific Verified Claim & Evidence
 */
export const ResearchEvidenceSchema = z.object({
  claim: z.string().min(1, 'Claim is required'),
  source: z.string().min(1, 'Source reference is required'),
  supporting_excerpt: z.string().min(1, 'Supporting excerpt is required'),
  confidence: ResearchConfidenceSchema,
  notes: z.string().optional(),
});

export type ValidatedResearchEvidence = z.infer<typeof ResearchEvidenceSchema>;

/**
 * Complete Zod Schema for Full Research Package
 */
export const ResearchPackageSchema = z.object({
  plan: ResearchPlanSchema,
  sources: z.array(ResearchSourceSchema).default([]),
  evidence: z.array(ResearchEvidenceSchema).default([]),
  unresolved_questions: z.array(z.string()).default([]),
  overall_confidence: ResearchConfidenceSchema,
  isMockData: z.boolean().optional(),
});

export type ValidatedResearchPackage = z.infer<typeof ResearchPackageSchema>;
