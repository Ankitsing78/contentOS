/**
 * ContentOS - Provider-Agnostic Research Interface & Factory
 * 
 * Allows swapping search engines or evidence retrievers (Tavily, SerpAPI,
 * Google Search, internal vector databases, or development mocks) without
 * altering the Research Agent architecture.
 */

import { ResearchPlan, ResearchRetrievalResult } from '@/types';
import { DevelopmentMockResearchProvider } from './mock-provider';
import { TavilyResearchProvider } from './tavily-provider';

export interface IResearchProvider {
  readonly id: string;
  readonly name: string;
  readonly isMock: boolean;
  gatherEvidence(plan: ResearchPlan): Promise<ResearchRetrievalResult>;
}

/**
 * Checks if Tavily API key is available in the server environment.
 */
export function isTavilyConfigured(): boolean {
  const key = process.env.TAVILY_API_KEY;
  return typeof key === 'string' && key.trim().length > 0;
}

/**
 * Resolves and instantiates the configured research provider.
 * 
 * Priority:
 * 1. Explicit argument providerId ('tavily' | 'mock')
 * 2. process.env.RESEARCH_PROVIDER
 * 3. process.env.RESEARCH_DEFAULT_PROVIDER
 * 4. Default: 'tavily' if TAVILY_API_KEY exists, otherwise 'mock'
 * 
 * Strict Constraint: If 'tavily' is requested but TAVILY_API_KEY is missing,
 * this function THROWS rather than silently falling back to mock fixtures.
 */
export function getResearchProvider(providerId?: string): IResearchProvider {
  const selectedId =
    providerId ||
    process.env.RESEARCH_PROVIDER ||
    process.env.RESEARCH_DEFAULT_PROVIDER ||
    (isTavilyConfigured() ? 'tavily' : 'mock');

  switch (selectedId.toLowerCase()) {
    case 'tavily': {
      if (!isTavilyConfigured()) {
        throw new Error(
          '[ContentOS] Research provider is configured as "tavily", but TAVILY_API_KEY is not set. ' +
            'Please set TAVILY_API_KEY in .env.local or set RESEARCH_PROVIDER="mock" for development.'
        );
      }
      return new TavilyResearchProvider();
    }

    case 'mock':
      return new DevelopmentMockResearchProvider();

    default:
      console.warn(
        `[ContentOS] Unknown RESEARCH_PROVIDER "${selectedId}". Defaulting to mock test fixture.`
      );
      return new DevelopmentMockResearchProvider();
  }
}
