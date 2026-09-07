/**
 * ContentOS - Research Query Generator
 * 
 * Generates focused, deterministic search queries from a ResearchPlan.
 * Avoids dumping full brief text or generating open-ended uncontrolled queries.
 */

import { ResearchPlan } from '@/types';

export interface GeneratedSearchQuery {
  query: string;
  sourceQuestion: string;
  intent: 'question' | 'claim' | 'fact';
}

/**
 * Strips punctuation, quotes, and conversational fluff to build high-precision search keywords.
 */
function cleanSearchKeywords(raw: string): string {
  return raw
    .replace(/[?"'`:;()[\]{}<>!*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts year or freshness keywords if specified in freshness_requirements.
 */
function extractFreshnessKeyword(freshness?: string): string {
  if (!freshness) return '';
  const match = freshness.match(/202[4-9]/);
  if (match) return match[0];
  if (freshness.toLowerCase().includes('recent') || freshness.toLowerCase().includes('month') || freshness.toLowerCase().includes('latest')) {
    return '2025 2026';
  }
  return '';
}

/**
 * Generates targeted search queries from a ResearchPlan.
 * Bounded by maxQueries (default: 3).
 */
export function generateSearchQueries(
  plan: ResearchPlan,
  maxQueries = 3
): GeneratedSearchQuery[] {
  const queries: GeneratedSearchQuery[] = [];
  const freshnessTag = extractFreshnessKeyword(plan.freshness_requirements);

  // 1. High-priority research questions
  for (const q of plan.research_questions) {
    if (queries.length >= maxQueries) break;
    const cleaned = cleanSearchKeywords(q);
    if (cleaned.length > 5) {
      const finalQuery = freshnessTag ? `${cleaned} ${freshnessTag}` : cleaned;
      queries.push({
        query: finalQuery,
        sourceQuestion: q,
        intent: 'question',
      });
    }
  }

  // 2. High-priority claims to verify if quota remains
  if (queries.length < maxQueries && plan.claims_to_verify && plan.claims_to_verify.length > 0) {
    for (const claim of plan.claims_to_verify) {
      if (queries.length >= maxQueries) break;
      const cleaned = cleanSearchKeywords(claim);
      if (cleaned.length > 5) {
        queries.push({
          query: `study research empirical "${cleaned.slice(0, 60)}"`,
          sourceQuestion: claim,
          intent: 'claim',
        });
      }
    }
  }

  // 3. Facts needed if quota still remains
  if (queries.length < maxQueries && plan.facts_needed && plan.facts_needed.length > 0) {
    for (const fact of plan.facts_needed) {
      if (queries.length >= maxQueries) break;
      const cleaned = cleanSearchKeywords(fact);
      if (cleaned.length > 5) {
        queries.push({
          query: `${cleaned} statistics report`,
          sourceQuestion: fact,
          intent: 'fact',
        });
      }
    }
  }

  return queries;
}
