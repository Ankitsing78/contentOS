/**
 * ContentOS - Tavily Web Research Client Wrapper
 * 
 * Server-only wrapper around @tavily/core.
 * Enforces bounded query limits, rate-limit classification, and credential safety.
 */

import 'server-only';
import { tavily, type TavilyClient as SdkTavilyClient } from '@tavily/core';

export interface TavilySearchOptions {
  searchDepth?: 'basic' | 'advanced';
  maxResults?: number;
  includeAnswer?: boolean;
  includeRawContent?: boolean | 'markdown' | 'text';
  includeDomains?: string[];
  excludeDomains?: string[];
}

export interface TavilySearchResultItem {
  title: string;
  url: string;
  content: string;
  score: number;
  publishedDate?: string;
  rawContent?: string;
}

export interface TavilySearchOutput {
  query: string;
  results: TavilySearchResultItem[];
  responseTime: number;
}

export interface TavilyExtractResultItem {
  url: string;
  rawContent: string;
}

export interface TavilyExtractOutput {
  results: TavilyExtractResultItem[];
  failedResults: { url: string; error: string }[];
  responseTime: number;
}

export interface ITavilyClient {
  search(query: string, options?: TavilySearchOptions): Promise<TavilySearchOutput>;
  extract(urls: string[]): Promise<TavilyExtractOutput>;
}

export class TavilyError extends Error {
  readonly status?: number;
  readonly code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'TavilyError';
    this.status = status;
    this.code = code;
  }
}

export class TavilyClient implements ITavilyClient {
  private sdkClient: SdkTavilyClient | null = null;
  private apiKey: string;

  constructor(customApiKey?: string) {
    this.apiKey = customApiKey || process.env.TAVILY_API_KEY || '';
  }

  private getClient(): SdkTavilyClient {
    if (this.sdkClient) {
      return this.sdkClient;
    }

    if (!this.apiKey || this.apiKey.trim().length === 0) {
      throw new TavilyError(
        'TAVILY_API_KEY is missing. Please set TAVILY_API_KEY in .env.local to enable real web research.',
        401,
        'MISSING_API_KEY'
      );
    }

    this.sdkClient = tavily({ apiKey: this.apiKey.trim() });
    return this.sdkClient;
  }

  /**
   * Executes a bounded web search.
   */
  async search(query: string, options?: TavilySearchOptions): Promise<TavilySearchOutput> {
    const client = this.getClient();
    const startTime = Date.now();

    const cleanQuery = query.trim();
    if (!cleanQuery) {
      return { query: '', results: [], responseTime: 0 };
    }

    try {
      const response = await client.search(cleanQuery, {
        searchDepth: options?.searchDepth || 'basic',
        maxResults: Math.min(options?.maxResults || 5, 10), // Hard cap at 10 to limit credit drain
        includeAnswer: options?.includeAnswer ?? false,
        includeRawContent: options?.includeRawContent === true ? 'markdown' : (options?.includeRawContent ?? undefined),
        includeDomains: options?.includeDomains,
        excludeDomains: options?.excludeDomains,
      });

      const results: TavilySearchResultItem[] = (response.results || []).map((r) => ({
        title: r.title || 'Untitled Web Document',
        url: r.url || '',
        content: r.content || '',
        score: r.score ?? 0,
        publishedDate: r.publishedDate,
        rawContent: r.rawContent,
      }));

      return {
        query: cleanQuery,
        results,
        responseTime: Date.now() - startTime,
      };
    } catch (err: unknown) {
      this.handleError(err, 'search');
    }
  }

  /**
   * Extracts clean web text from selected URLs.
   */
  async extract(urls: string[]): Promise<TavilyExtractOutput> {
    const client = this.getClient();
    const startTime = Date.now();

    const validUrls = urls
      .map((u) => u.trim())
      .filter((u) => u.startsWith('http://') || u.startsWith('https://'))
      .slice(0, 5); // Hard cap at 5 URLs per extract call

    if (validUrls.length === 0) {
      return { results: [], failedResults: [], responseTime: 0 };
    }

    try {
      const response = await client.extract(validUrls);

      const results: TavilyExtractResultItem[] = (response.results || []).map((r) => ({
        url: r.url,
        rawContent: r.rawContent || '',
      }));

      const failedResults = (response.failedResults || []).map((f) => ({
        url: f.url,
        error: f.error || 'Failed to extract content',
      }));

      return {
        results,
        failedResults,
        responseTime: Date.now() - startTime,
      };
    } catch (err: unknown) {
      this.handleError(err, 'extract');
    }
  }

  private handleError(err: unknown, operation: string): never {
    const message = err instanceof Error ? err.message : 'Unknown Tavily error';

    // Parse status code if available
    let status = 500;
    if (message.includes('401') || message.toLowerCase().includes('unauthorized') || message.toLowerCase().includes('invalid api key')) {
      status = 401;
    } else if (message.includes('429') || message.toLowerCase().includes('rate limit')) {
      status = 429;
    } else if (message.includes('400') || message.toLowerCase().includes('bad request')) {
      status = 400;
    }

    console.error(`[ContentOS] Tavily ${operation} error [${status}]:`, message);
    throw new TavilyError(`Tavily ${operation} failed: ${message}`, status);
  }
}
