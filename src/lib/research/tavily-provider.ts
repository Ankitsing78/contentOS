/**
 * ContentOS - Tavily Web Research Retrieval Provider
 * 
 * Implements IResearchProvider using a two-stage retrieval strategy:
 * Phase 1: Bounded, targeted search queries.
 * Phase 2: Selective extraction of high-value candidate URLs.
 * Phase 3: Gemini evidence synthesis with prompt injection defenses.
 */

import {
  IResearchProvider,
} from './provider';
import {
  ResearchPlan,
  ResearchRetrievalResult,
  ResearchSource,
} from '@/types';
import { ITavilyClient, TavilyClient, TavilySearchResultItem } from './tavily-client';
import { generateSearchQueries } from './query-generator';
import { evaluateSourceQuality } from './credibility';
import { synthesizeEvidence, RetrievedDocumentInput } from './synthesis';
import { IAIProvider } from '@/lib/ai/provider';

export interface TavilyProviderOptions {
  client?: ITavilyClient;
  aiProvider?: IAIProvider;
  maxQuestions?: number;
  maxSearchesPerQuestion?: number;
  maxExtractSources?: number;
  searchDepth?: 'basic' | 'advanced';
}

export class TavilyResearchProvider implements IResearchProvider {
  readonly id = 'tavily';
  readonly name = 'Tavily Web Search & Extraction Provider';
  readonly isMock = false;

  private client: ITavilyClient;
  private customAiProvider?: IAIProvider;
  private maxQuestions: number;
  private maxSearchesPerQuestion: number;
  private maxExtractSources: number;
  private searchDepth: 'basic' | 'advanced';

  constructor(options?: TavilyProviderOptions) {
    this.client = options?.client || new TavilyClient();
    this.customAiProvider = options?.aiProvider;
    this.maxQuestions = options?.maxQuestions || parseInt(process.env.RESEARCH_MAX_QUESTIONS || '3', 10);
    this.maxSearchesPerQuestion = options?.maxSearchesPerQuestion || parseInt(process.env.RESEARCH_MAX_SEARCHES_PER_QUESTION || '1', 10);
    this.maxExtractSources = options?.maxExtractSources || parseInt(process.env.RESEARCH_MAX_EXTRACT_SOURCES || '3', 10);
    this.searchDepth = (options?.searchDepth || process.env.RESEARCH_SEARCH_DEPTH || 'basic') as 'basic' | 'advanced';
  }

  /**
   * Executes bounded live web research.
   */
  async gatherEvidence(plan: ResearchPlan): Promise<ResearchRetrievalResult> {
    console.log('[ContentOS] [TavilyResearchProvider] generating targeted search queries');

    // 1. Generate focused search queries from the ResearchPlan
    const queries = generateSearchQueries(plan, this.maxQuestions);
    if (queries.length === 0) {
      console.warn('[ContentOS] [TavilyResearchProvider] No search queries could be derived from plan');
      return {
        provider: this.id,
        sources: [],
        evidence: [],
        unresolved_questions: plan.research_questions,
        overall_confidence: 'low',
        isMockData: false,
      };
    }

    console.log(
      `[ContentOS] [TavilyResearchProvider] executing ${queries.length} search queries (depth: ${this.searchDepth})`
    );

    // 2. Phase 1: Search - execute bounded searches
    const collectedResults: TavilySearchResultItem[] = [];
    const seenUrls = new Set<string>();

    for (const q of queries) {
      try {
        console.log(`[ContentOS] [TavilyResearchProvider] searching query: "${q.query}"`);
        const searchRes = await this.client.search(q.query, {
          searchDepth: this.searchDepth,
          maxResults: 3, // Keep top 3 per query to limit waste
        });

        for (const item of searchRes.results) {
          const normUrl = item.url.trim().toLowerCase();
          if (normUrl && !seenUrls.has(normUrl)) {
            seenUrls.add(normUrl);
            collectedResults.push(item);
          }
        }
      } catch (searchErr) {
        console.warn(
          `[ContentOS] [TavilyResearchProvider] search failed for query "${q.query}":`,
          searchErr instanceof Error ? searchErr.message : 'Unknown'
        );
        // Continue to other queries for partial failure resilience
      }
    }

    if (collectedResults.length === 0) {
      console.warn('[ContentOS] [TavilyResearchProvider] Zero search results found across all queries');
      return {
        provider: this.id,
        sources: [],
        evidence: [],
        unresolved_questions: plan.research_questions,
        overall_confidence: 'low',
        isMockData: false,
      };
    }

    // 3. Phase 2: Extraction - Rank and select URLs for full content extraction
    // Sort by search score descending
    collectedResults.sort((a, b) => (b.score || 0) - (a.score || 0));

    const topCandidateUrls = collectedResults
      .slice(0, this.maxExtractSources)
      .map((r) => r.url);

    console.log(
      `[ContentOS] [TavilyResearchProvider] selectively extracting content from ${topCandidateUrls.length} candidate URLs`
    );

    const extractedTextMap = new Map<string, string>();
    try {
      const extractRes = await this.client.extract(topCandidateUrls);
      for (const item of extractRes.results) {
        if (item.rawContent && item.rawContent.trim().length > 0) {
          extractedTextMap.set(item.url.trim().toLowerCase(), item.rawContent);
        }
      }
    } catch (extractErr) {
      console.warn(
        '[ContentOS] [TavilyResearchProvider] Tavily extract notice (falling back to search snippets):',
        extractErr instanceof Error ? extractErr.message : 'Notice'
      );
    }

    // 4. Build Structured Research Sources
    const retrievedAt = new Date().toISOString();
    const finalSources: ResearchSource[] = [];
    const synthesisDocs: RetrievedDocumentInput[] = [];

    let docIndex = 1;
    for (const item of collectedResults) {
      const normUrl = item.url.trim().toLowerCase();
      const extractedContent = extractedTextMap.get(normUrl) || item.content;
      const quality = evaluateSourceQuality(item.url, item.score, item.title);

      const researchSource: ResearchSource = {
        title: item.title,
        url: item.url,
        publisher: quality.publisher,
        published_at: item.publishedDate || undefined,
        retrieved_at: retrievedAt,
        source_type: quality.sourceType,
        relevance: quality.relevance,
        credibility: quality.credibility,
        evidence_summary: item.content.slice(0, 300).trim(),
      };

      finalSources.push(researchSource);

      synthesisDocs.push({
        index: docIndex++,
        title: item.title,
        url: item.url,
        publisher: quality.publisher,
        content: extractedContent,
      });
    }

    // 5. Phase 3: Gemini Synthesis & Evidence Verification
    console.log(
      `[ContentOS] [TavilyResearchProvider] synthesizing evidence across ${synthesisDocs.length} retrieved documents`
    );
    const synthesis = await synthesizeEvidence(plan, synthesisDocs, this.customAiProvider);

    return {
      provider: this.id,
      sources: finalSources,
      evidence: synthesis.evidence,
      unresolved_questions: synthesis.unresolved_questions,
      overall_confidence: synthesis.overall_confidence,
      isMockData: false,
    };
  }
}
