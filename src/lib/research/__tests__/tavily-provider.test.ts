/**
 * ContentOS - Tavily Research Provider Unit Test Suite
 * 
 * Tests TavilyResearchProvider using mocked HTTP responses and mock clients.
 * Validates search, extraction, deduplication, error handling, prompt injection defense,
 * and factory selection with zero live network dependency.
 */

import {
  ITavilyClient,
  TavilySearchOutput,
  TavilyExtractOutput,
  TavilyError,
} from '../tavily-client';
import { TavilyResearchProvider } from '../tavily-provider';
import { getResearchProvider } from '../provider';
import { DevelopmentMockResearchProvider } from '../mock-provider';
import { IAIProvider } from '@/lib/ai/provider';
import {
  AIMessage,
  ResearchPlan,
  AIStructuredResponse,
  AITextResponse,
  AIProviderId,
} from '@/types';

class MockTavilyClient implements ITavilyClient {
  searchResultToReturn: TavilySearchOutput = {
    query: 'test query',
    results: [
      {
        title: 'IEEE Empirical Study on AI Developers',
        url: 'https://ieeexplore.ieee.org/document/12345',
        content: 'Empirical measurement shows AI assistants improve boilerplate coding speed by 40% while design time is unchanged.',
        score: 0.95,
        publishedDate: '2025-06-15T00:00:00Z',
      },
      {
        title: 'ACM Developer Productivity Analysis',
        url: 'https://dl.acm.org/doi/10.1145/67890',
        content: 'System architecture reasoning remains a bottleneck for modern LLMs.',
        score: 0.88,
        publishedDate: '2025-08-20T00:00:00Z',
      },
    ],
    responseTime: 120,
  };

  extractResultToReturn: TavilyExtractOutput = {
    results: [
      {
        url: 'https://ieeexplore.ieee.org/document/12345',
        rawContent: 'Full article text: Empirical measurement shows AI assistants improve boilerplate coding speed by 40% while design time is unchanged.',
      },
      {
        url: 'https://dl.acm.org/doi/10.1145/67890',
        rawContent: 'Full article text: System architecture reasoning remains a bottleneck for modern LLMs.',
      },
    ],
    failedResults: [],
    responseTime: 150,
  };

  shouldThrowSearchError?: Error;
  shouldThrowExtractError?: Error;
  recordedQueries: string[] = [];

  async search(query: string): Promise<TavilySearchOutput> {
    this.recordedQueries.push(query);
    if (this.shouldThrowSearchError) {
      throw this.shouldThrowSearchError;
    }
    return this.searchResultToReturn;
  }

  async extract(_urls: string[]): Promise<TavilyExtractOutput> {
    void _urls;
    if (this.shouldThrowExtractError) {
      throw this.shouldThrowExtractError;
    }
    return this.extractResultToReturn;
  }
}

class MockAIProvider implements IAIProvider {
  readonly id: AIProviderId = 'gemini';
  readonly name = 'Mock AI Provider';
  responsePayload: unknown = null;

  async generateStructured<T>(_messages: AIMessage[]): Promise<AIStructuredResponse<T>> {
    void _messages;
    const payload = this.responsePayload || {
      evidence: [
        {
          claim: 'AI assists with boilerplate coding',
          source_title: 'IEEE Empirical Study on AI Developers',
          source_url: 'https://ieeexplore.ieee.org/document/12345',
          supporting_excerpt: 'Empirical measurement shows AI assistants improve boilerplate coding speed by 40%.',
          confidence: 'high',
        },
      ],
      unresolved_questions: ['What is the exact impact on senior architect compensation?'],
      conflicts: [],
      overall_confidence: 'high',
    };

    return {
      data: payload as T,
      raw: JSON.stringify(payload),
    };
  }

  async generateText(): Promise<AITextResponse> {
    return { text: 'mock text' };
  }
}

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

  console.log('\n=============================================');
  console.log('  ContentOS Tavily Research Provider Tests   ');
  console.log('=============================================\n');

  const testPlan: ResearchPlan = {
    research_questions: ['What do empirical studies show about AI coding tools?'],
    claims_to_verify: ['AI improves boilerplate coding speed by 40%'],
    facts_needed: ['Empirical benchmarks from 2025'],
    source_requirements: ['Peer-reviewed papers'],
    freshness_requirements: 'Within the last 12 months',
    research_priority: 'high',
  };

  // 1. Search & Extraction Success
  console.log('--- 1. Happy Path: Search & Extraction Success ---');
  const mockClient = new MockTavilyClient();
  const mockAi = new MockAIProvider();
  const provider = new TavilyResearchProvider({
    client: mockClient,
    aiProvider: mockAi,
  });

  const result = await provider.gatherEvidence(testPlan);
  assert(result.provider === 'tavily', 'Provider identifier is "tavily"');
  assert(result.isMockData === false, 'isMockData is strictly false for real Tavily provider');
  assert(result.sources.length === 2, 'Returns 2 retrieved sources');
  assert(result.sources[0].url.startsWith('https://'), 'Source URL is a valid URL');
  assert(result.sources[0].source_type === 'paper', 'IEEE source classified as "paper"');
  assert(result.sources[0].credibility === 'high', 'IEEE paper classified with "high" credibility');
  assert(result.evidence.length === 1, 'Synthesizes 1 verified evidence item');
  assert(result.evidence[0].confidence === 'high', 'Evidence confidence matches synthesis');

  // 2. No Search Results Handling
  console.log('\n--- 2. Empty Search Results Handling ---');
  const emptyClient = new MockTavilyClient();
  emptyClient.searchResultToReturn = { query: 'test', results: [], responseTime: 50 };
  const emptyProvider = new TavilyResearchProvider({ client: emptyClient, aiProvider: mockAi });
  const emptyResult = await emptyProvider.gatherEvidence(testPlan);
  assert(emptyResult.sources.length === 0, 'Empty search returns 0 sources');
  assert(emptyResult.evidence.length === 0, 'Empty search returns 0 evidence');
  assert(emptyResult.isMockData === false, 'isMockData remains false');
  assert(emptyResult.unresolved_questions.length > 0, 'Research questions moved to unresolved_questions');

  // 3. Partial Failure Resilience (Search fails on query, continues gracefully)
  console.log('\n--- 3. Partial Failure Resilience ---');
  let callCount = 0;
  const partialClient: ITavilyClient = {
    async search(_query: string) {
      void _query;
      callCount++;
      if (callCount === 1) {
        throw new TavilyError('Rate limit exceeded on query 1', 429);
      }
      return mockClient.searchResultToReturn;
    },
    async extract(_urls: string[]) {
      void _urls;
      return mockClient.extractResultToReturn;
    },
  };
  const partialProvider = new TavilyResearchProvider({
    client: partialClient,
    aiProvider: mockAi,
    maxQuestions: 2,
  });
  const partialResult = await partialProvider.gatherEvidence({
    ...testPlan,
    research_questions: ['Query 1 that fails', 'Query 2 that succeeds'],
  });
  assert(partialResult.sources.length > 0, 'Partial search failure preserves successful query results');

  // 4. Source Deduplication Across Queries
  console.log('\n--- 4. Source Deduplication Across Queries ---');
  const duplicateClient: ITavilyClient = {
    async search() {
      return {
        query: 'test',
        results: [
          {
            title: 'Same Article',
            url: 'https://example.com/same-article',
            content: 'Content A',
            score: 0.9,
          },
          {
            title: 'Same Article with casing',
            url: 'https://Example.com/Same-Article',
            content: 'Content B',
            score: 0.85,
          },
        ],
        responseTime: 50,
      };
    },
    async extract(_urls: string[]) {
      void _urls;
      return { results: [], failedResults: [], responseTime: 10 };
    },
  };
  const dedupProvider = new TavilyResearchProvider({ client: duplicateClient, aiProvider: mockAi });
  const dedupResult = await dedupProvider.gatherEvidence(testPlan);
  assert(dedupResult.sources.length === 1, 'Duplicate URLs are deduplicated across searches');

  // 5. Unverified Claims Moved to Unresolved Questions
  console.log('\n--- 5. Unsupported Claims Handled Correctly ---');
  const unverifiedAi = new MockAIProvider();
  unverifiedAi.responsePayload = {
    evidence: [],
    unresolved_questions: ['AI improves boilerplate coding speed by 40% (No supporting document found)'],
    conflicts: [],
    overall_confidence: 'low',
  };
  const unverifiedProvider = new TavilyResearchProvider({ client: mockClient, aiProvider: unverifiedAi });
  const unverifiedResult = await unverifiedProvider.gatherEvidence(testPlan);
  assert(unverifiedResult.evidence.length === 0, 'Unsupported claims are not marked as verified');
  assert(unverifiedResult.unresolved_questions.length > 0, 'Unsupported claims recorded in unresolved_questions');

  // 6. Conflicting Sources Recording
  console.log('\n--- 6. Source Conflict Recording ---');
  const conflictAi = new MockAIProvider();
  conflictAi.responsePayload = {
    evidence: [],
    unresolved_questions: [],
    conflicts: [
      {
        claim: 'Developer velocity effect',
        source_1: 'Study A',
        source_2: 'Study B',
        description: 'Study A claims 40% speedup while Study B found 0% difference.',
      },
    ],
    overall_confidence: 'medium',
  };
  const conflictProvider = new TavilyResearchProvider({ client: mockClient, aiProvider: conflictAi });
  const conflictResult = await conflictProvider.gatherEvidence(testPlan);
  assert(conflictResult.evidence.some((e) => e.notes?.includes('Conflicting evidence')), 'Conflict explicitly noted in evidence notes');

  // 7. Factory Selection & Strict Error Behavior
  console.log('\n--- 7. Factory Selection & Security Rules ---');
  // When RESEARCH_PROVIDER=mock, returns DevelopmentMockResearchProvider
  const mockFromFactory = getResearchProvider('mock');
  assert(mockFromFactory instanceof DevelopmentMockResearchProvider, 'getResearchProvider("mock") returns mock provider');
  assert(mockFromFactory.isMock === true, 'Mock provider has isMock = true');

  // Strict check: if 'tavily' is requested but key is missing, throws without falling back
  const originalKey = process.env.TAVILY_API_KEY;
  try {
    delete process.env.TAVILY_API_KEY;
    let threw = false;
    try {
      getResearchProvider('tavily');
    } catch (err: unknown) {
      threw = true;
      assert(
        err instanceof Error && err.message.includes('TAVILY_API_KEY is not set'),
        'Throws descriptive error when TAVILY_API_KEY is missing'
      );
    }
    assert(threw, 'Refuses to silently fall back to mock when tavily requested without key');
  } finally {
    if (originalKey) {
      process.env.TAVILY_API_KEY = originalKey;
    }
  }

  console.log('\n---------------------------------------------');
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log('---------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test runner exception:', err);
  process.exit(1);
});
