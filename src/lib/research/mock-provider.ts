/**
 * ContentOS - Development Mock Research Provider
 * 
 * CRITICAL ARCHITECTURAL BOUNDARY:
 * - This mock is for local pipeline validation and development testing ONLY.
 * - It strictly NEVER invents fake external URLs, hallucinated statistics, or pretend citations.
 * - Sources returned are explicitly stamped with source_type: 'mock_test_fixture'.
 * - Real search/retrieval vendors (Tavily, SerpAPI, Google Search) will plug into
 *   IResearchProvider in future steps.
 */

import {
  ResearchPlan,
  ResearchRetrievalResult,
  ResearchSource,
  ResearchEvidence,
} from '@/types';
import { IResearchProvider } from './provider';

export class DevelopmentMockResearchProvider implements IResearchProvider {
  readonly id = 'mock' as const;
  readonly name = 'Development Mock Research Provider (Pipeline Test Only)';
  readonly isMock = true;

  async gatherEvidence(plan: ResearchPlan): Promise<ResearchRetrievalResult> {
    const timestamp = new Date().toISOString();

    // If no claims to verify or plan is empty, return empty evidence set cleanly
    if (!plan.claims_to_verify.length && !plan.facts_needed.length) {
      return {
        provider: this.id,
        sources: [],
        evidence: [],
        unresolved_questions: plan.research_questions,
        overall_confidence: 'low',
        isMockData: true,
      };
    }

    // Deterministic mock test fixture: clearly labeled so it cannot be mistaken for real research
    const fixtureSource: ResearchSource = {
      title: '[DEV TEST FIXTURE] Mock Internal Verification Stub',
      url: '', // Explicitly empty — no fabricated external URL
      publisher: 'ContentOS Development Test Harness',
      published_at: timestamp,
      retrieved_at: timestamp,
      source_type: 'mock_test_fixture',
      relevance: 'medium',
      credibility: 'low',
      evidence_summary:
        'Notice: External search API is not yet connected. Real web retrieval will be integrated via IResearchProvider in the next integration step.',
    };

    const fixtureEvidence: ResearchEvidence[] = plan.claims_to_verify.slice(0, 2).map((claim) => ({
      claim,
      source: fixtureSource.title,
      supporting_excerpt: `[MOCK EVIDENCE STUB] Claim verification pending real web search provider integration for claim: "${claim}"`,
      confidence: 'low' as const,
      notes: 'Development-only mock verification stub. Do not use in production publish.',
    }));

    return {
      provider: this.id,
      sources: [fixtureSource],
      evidence: fixtureEvidence,
      unresolved_questions: plan.research_questions,
      overall_confidence: 'low',
      isMockData: true,
    };
  }
}
